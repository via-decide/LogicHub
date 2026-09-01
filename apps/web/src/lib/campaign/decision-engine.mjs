const TERMINAL_VALID_EVIDENCE = new Set(['PRESENT', 'REVIEWED', 'REPLICATED', 'EXTERNALLY_VERIFIED']);
const INVALID_EVIDENCE = new Set(['STALE', 'INVALIDATED']);
const TEST_PASS = 'PASS';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function validateCampaignData(input) {
  const errors = [];
  const evidence = asArray(input?.evidence);
  const tests = asArray(input?.tests);
  const measurements = asArray(input?.measurements);
  const revisions = new Set(asArray(input?.componentRevisions).map((item) => item.id));

  const evidenceIds = new Set();
  for (const item of evidence) {
    if (!item?.id) errors.push('Evidence item missing id.');
    else if (evidenceIds.has(item.id)) errors.push(`Duplicate evidence ID: ${item.id}`);
    else evidenceIds.add(item.id);

    for (const revisionId of asArray(item?.boundRevisionIds)) {
      if (!revisions.has(revisionId)) errors.push(`Unknown component revision ${revisionId} referenced by ${item.id}.`);
    }
  }

  for (const measurement of measurements) {
    if (!measurement?.id || !measurement?.metric || !Number.isFinite(measurement?.value)) {
      errors.push(`Malformed measurement: ${measurement?.id ?? 'unknown-id'}`);
    }
  }

  for (const test of tests) {
    if (test?.status === TEST_PASS) {
      const required = asArray(test.requiredEvidenceIds);
      const present = required.filter((id) => evidenceIds.has(id));
      if (required.length === 0 || present.length !== required.length) {
        errors.push(`Test ${test.id} is PASS without all required evidence.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function applyRevisionChange(input, change) {
  const evidence = asArray(input?.evidence).map((item) => ({ ...item }));
  const tests = asArray(input?.tests).map((item) => ({ ...item }));
  const affectedEvidenceIds = [];
  const affectedTestIds = [];
  const changedAttributes = new Set(asArray(change?.changedAttributes));

  for (const item of evidence) {
    const bound = asArray(item.boundRevisionIds);
    const keys = asArray(item.validityKeys);
    const boundToSupersededRevision = bound.includes(change?.fromRevisionId);
    const validityDependsOnChange = keys.some((key) => changedAttributes.has(key));

    if (boundToSupersededRevision && validityDependsOnChange && item.state !== 'INVALIDATED') {
      item.state = 'STALE';
      item.staleReason = change?.reason || 'Relevant engineering configuration changed.';
      affectedEvidenceIds.push(item.id);
    }
  }

  const affectedSet = new Set(affectedEvidenceIds);
  for (const test of tests) {
    if (asArray(test.requiredEvidenceIds).some((id) => affectedSet.has(id))) {
      test.status = 'REVIEW_REQUIRED';
      test.reviewReason = `Evidence became stale after ${change?.fromRevisionId} → ${change?.toRevisionId}.`;
      affectedTestIds.push(test.id);
    }
  }

  return {
    ...input,
    currentRevisionId: change?.machineRevisionId || input?.currentRevisionId,
    evidence,
    tests,
    revisionImpact: {
      changeId: change?.id,
      affectedEvidenceIds,
      affectedTestIds,
    },
  };
}

function effectiveTestState(test, evidenceById) {
  if (test.status !== TEST_PASS) return test.status;
  const requiredIds = asArray(test.requiredEvidenceIds);
  if (requiredIds.length === 0) return 'INCONCLUSIVE';

  let sawStale = false;
  for (const id of requiredIds) {
    const item = evidenceById.get(id);
    if (!item) return 'INCONCLUSIVE';
    if (item.state === 'INVALIDATED') return 'INCONCLUSIVE';
    if (item.state === 'STALE') sawStale = true;
    if (!TERMINAL_VALID_EVIDENCE.has(item.state) && !INVALID_EVIDENCE.has(item.state)) return 'INCONCLUSIVE';
  }
  return sawStale ? 'REVIEW_REQUIRED' : TEST_PASS;
}

export function aggregateDependencies(input) {
  const tests = asArray(input?.tests);
  const evidence = asArray(input?.evidence);
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  return asArray(input?.dependencies).map((dependency) => {
    const dependencyTests = tests.filter((test) => asArray(test.dependencyIds).includes(dependency.id));
    const states = dependencyTests.map((test) => effectiveTestState(test, evidenceById));
    const evidenceIds = new Set(
      dependencyTests.flatMap((test) => asArray(test.requiredEvidenceIds)).filter((id) => evidenceById.has(id)),
    );
    const total = dependencyTests.length;
    const completed = states.filter((state) => ['PASS', 'FAIL', 'INCONCLUSIVE'].includes(state)).length;
    const hasFail = states.includes('FAIL');
    const hasReview = states.includes('REVIEW_REQUIRED') || states.includes('STALE');
    const hasIncomplete = states.some((state) => ['PLANNED', 'READY', 'RUNNING', 'BLOCKED', 'REPEAT_REQUIRED', 'NOT_PLANNED'].includes(state));

    let status = 'UNTESTED';
    if (hasFail) status = 'FAILED';
    else if (hasReview || hasIncomplete) status = 'CONDITIONAL';
    else if (total > 0 && states.every((state) => state === 'PASS')) status = 'SUPPORTED';

    return {
      ...dependency,
      status,
      testCount: total,
      completedTestCount: completed,
      evidenceCount: evidenceIds.size,
      coveragePct: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  });
}

export function evaluateCampaign(input) {
  const validation = validateCampaignData(input);
  const tests = asArray(input?.tests);
  const evidence = asArray(input?.evidence);
  const requirements = asArray(input?.requirements).filter((req) => req.claimScope === input?.decisionScope);
  const failures = asArray(input?.failures);
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const testById = new Map(tests.map((test) => [test.id, test]));

  const criticalRequirements = requirements.filter((req) => req.critical === true);
  const reasons = [];
  const linkedTestIds = new Set();
  const linkedEvidenceIds = new Set();
  let passedCritical = 0;
  let failedInvalidating = 0;
  let failedConditional = 0;
  let incompleteCritical = 0;
  let staleCritical = 0;

  for (const requirement of criticalRequirements) {
    const states = [];
    for (const testId of asArray(requirement.testIds)) {
      const test = testById.get(testId);
      if (!test) {
        states.push('INCONCLUSIVE');
        continue;
      }
      linkedTestIds.add(testId);
      for (const evidenceId of asArray(test.requiredEvidenceIds)) linkedEvidenceIds.add(evidenceId);
      states.push(effectiveTestState(test, evidenceById));
    }

    const requirementPass = states.length > 0 && states.every((state) => state === 'PASS');
    const requirementFail = states.includes('FAIL');
    const requirementStale = states.includes('REVIEW_REQUIRED') || states.includes('STALE');
    const requirementIncomplete = states.length === 0 || states.some((state) => !['PASS', 'FAIL'].includes(state));

    if (requirementPass) passedCritical += 1;
    if (requirementFail) {
      if (requirement.conditionalAllowed) failedConditional += 1;
      else failedInvalidating += 1;
    }
    if (requirementStale) staleCritical += 1;
    else if (requirementIncomplete) incompleteCritical += 1;
  }

  const criticalBlockers = failures.filter((failure) =>
    failure.severity === 'CRITICAL' && !['CONTAINED', 'FIX_VERIFIED', 'CLOSED'].includes(failure.status),
  );

  if (!validation.valid) reasons.push(`${validation.errors.length} data-integrity violation(s) require review.`);
  if (failedInvalidating > 0) reasons.push(`${failedInvalidating} critical requirement(s) failed without an allowed scope constraint.`);
  if (failedConditional > 0) reasons.push(`${failedConditional} critical requirement(s) failed but have an explicit narrowed-duty condition.`);
  if (staleCritical > 0) reasons.push(`${staleCritical} critical requirement(s) rely on stale or superseded evidence.`);
  if (incompleteCritical > 0) reasons.push(`${incompleteCritical} critical requirement(s) are incomplete or inconclusive.`);
  if (criticalBlockers.length > 0) reasons.push(`${criticalBlockers.length} critical blocker(s) remain open.`);
  if (passedCritical > 0) reasons.push(`${passedCritical}/${criticalRequirements.length} critical requirement(s) currently have valid PASS evidence.`);

  let decision = 'INCONCLUSIVE';
  let claimState = 'REVIEW_REQUIRED';

  if (!validation.valid) {
    decision = 'INCONCLUSIVE';
    claimState = 'REVIEW_REQUIRED';
  } else if (failedInvalidating > 0) {
    decision = 'FAILED';
    claimState = 'FAILED';
  } else if (
    criticalRequirements.length > 0 &&
    passedCritical === criticalRequirements.length &&
    criticalBlockers.length === 0
  ) {
    decision = 'SUPPORTED';
    claimState = 'SUPPORTED';
  } else if (passedCritical > 0 && (failedConditional > 0 || staleCritical > 0 || incompleteCritical > 0 || criticalBlockers.length > 0)) {
    decision = 'CONDITIONALLY_SUPPORTED';
    claimState = staleCritical > 0 ? 'REVIEW_REQUIRED' : 'CONDITIONALLY_SUPPORTED';
  }

  return {
    decision,
    claimState,
    reasons,
    linkedTestIds: [...linkedTestIds],
    linkedEvidenceIds: [...linkedEvidenceIds],
    counts: {
      criticalRequirements: criticalRequirements.length,
      passedCritical,
      failedInvalidating,
      failedConditional,
      incompleteCritical,
      staleCritical,
      criticalBlockers: criticalBlockers.length,
    },
    validation,
  };
}
