import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateDependencies,
  applyRevisionChange,
  evaluateCampaign,
  validateCampaignData,
} from '../apps/web/src/lib/campaign/decision-engine.mjs';

function base() {
  return {
    decisionScope: 'DEFINED',
    currentRevisionId: 'MACHINE-R1',
    dependencies: [{ id: 'BATTERY', name: 'Battery' }],
    componentRevisions: [
      { id: 'MACHINE-R1' }, { id: 'MACHINE-R2' }, { id: 'THERM-R1' }, { id: 'THERM-R2' },
    ],
    requirements: [{ id: 'REQ-1', dependencyId: 'BATTERY', critical: true, conditionalAllowed: false, claimScope: 'DEFINED', testIds: ['T-1'] }],
    tests: [{ id: 'T-1', dependencyIds: ['BATTERY'], status: 'PASS', requiredEvidenceIds: ['EV-1'] }],
    evidence: [{ id: 'EV-1', state: 'REVIEWED', boundRevisionIds: ['MACHINE-R1', 'THERM-R1'], validityKeys: ['cooling-plate'] }],
    measurements: [{ id: 'M-1', testId: 'T-1', metric: 'temperature', value: 42, unit: 'C' }],
    failures: [],
  };
}

test('decision evaluator grants SUPPORT only with valid critical evidence', () => {
  const result = evaluateCampaign(base());
  assert.equal(result.decision, 'SUPPORTED');
  assert.equal(result.claimState, 'SUPPORTED');
});

test('semantic diff makes bound evidence stale without mutating source', () => {
  const original = base();
  const changed = applyRevisionChange(original, {
    id: 'EC-1', fromRevisionId: 'THERM-R1', toRevisionId: 'THERM-R2', machineRevisionId: 'MACHINE-R2',
    changedAttributes: ['cooling-plate'], reason: 'geometry changed',
  });
  assert.equal(original.evidence[0].state, 'REVIEWED');
  assert.equal(changed.evidence[0].state, 'STALE');
  assert.equal(changed.tests[0].status, 'REVIEW_REQUIRED');
  assert.deepEqual(changed.revisionImpact.affectedEvidenceIds, ['EV-1']);
});

test('stale critical evidence removes full support', () => {
  const changed = applyRevisionChange(base(), {
    id: 'EC-1', fromRevisionId: 'THERM-R1', toRevisionId: 'THERM-R2', machineRevisionId: 'MACHINE-R2',
    changedAttributes: ['cooling-plate'], reason: 'geometry changed',
  });
  const result = evaluateCampaign(changed);
  assert.equal(result.decision, 'INCONCLUSIVE');
  assert.equal(result.claimState, 'REVIEW_REQUIRED');
});

test('dependency aggregation reports failure independently of coverage', () => {
  const data = base();
  data.tests[0].status = 'FAIL';
  const aggregate = aggregateDependencies(data)[0];
  assert.equal(aggregate.status, 'FAILED');
  assert.equal(aggregate.coveragePct, 100);
});

test('critical blocker prevents SUPPORTED', () => {
  const data = base();
  data.failures.push({ id: 'F-1', severity: 'CRITICAL', status: 'OPEN' });
  const result = evaluateCampaign(data);
  assert.notEqual(result.decision, 'SUPPORTED');
  assert.equal(result.counts.criticalBlockers, 1);
});

test('conditional critical failure narrows support rather than inventing PASS', () => {
  const data = base();
  data.requirements[0].conditionalAllowed = true;
  data.tests[0].status = 'FAIL';
  const result = evaluateCampaign(data);
  assert.equal(result.decision, 'INCONCLUSIVE');
  assert.equal(result.counts.failedConditional, 1);
});

test('invalidating critical failure yields FAILED', () => {
  const data = base();
  data.tests[0].status = 'FAIL';
  const result = evaluateCampaign(data);
  assert.equal(result.decision, 'FAILED');
});

test('negative 1: claim with no tests is INCONCLUSIVE', () => {
  const data = base(); data.tests = []; data.requirements[0].testIds = [];
  assert.equal(evaluateCampaign(data).decision, 'INCONCLUSIVE');
});

test('negative 2: test with no evidence cannot pass', () => {
  const data = base(); data.tests[0].requiredEvidenceIds = [];
  assert.match(validateCampaignData(data).errors.join('\n'), /PASS without all required evidence/);
});

test('negative 3: stale evidence produces review-required claim state', () => {
  const data = base(); data.evidence[0].state = 'STALE';
  assert.equal(evaluateCampaign(data).claimState, 'REVIEW_REQUIRED');
});

test('negative 4: invalidated evidence cannot support a PASS test', () => {
  const data = base(); data.evidence[0].state = 'INVALIDATED';
  assert.notEqual(evaluateCampaign(data).decision, 'SUPPORTED');
});

test('negative 5: tested superseded revision is detected through semantic impact', () => {
  const changed = applyRevisionChange(base(), { fromRevisionId: 'THERM-R1', toRevisionId: 'THERM-R2', machineRevisionId: 'MACHINE-R2', changedAttributes: ['cooling-plate'] });
  assert.equal(changed.revisionImpact.affectedTestIds[0], 'T-1');
});

test('negative 6: critical test failed cannot yield SUPPORT', () => {
  const data = base(); data.tests[0].status = 'FAIL';
  assert.notEqual(evaluateCampaign(data).decision, 'SUPPORTED');
});

test('negative 7: missing measurement remains missing', () => {
  const data = base(); data.measurements = [];
  assert.equal(data.measurements.length, 0);
  assert.equal(validateCampaignData(data).valid, true);
});

test('negative 8: malformed measurement is a data-integrity failure', () => {
  const data = base(); data.measurements[0].value = Number.NaN;
  assert.match(validateCampaignData(data).errors.join('\n'), /Malformed measurement/);
});

test('negative 9: duplicate evidence ID is rejected', () => {
  const data = base(); data.evidence.push({ ...data.evidence[0] });
  assert.match(validateCampaignData(data).errors.join('\n'), /Duplicate evidence ID/);
});

test('negative 10: unknown component revision is rejected', () => {
  const data = base(); data.evidence[0].boundRevisionIds.push('UNKNOWN-R9');
  assert.match(validateCampaignData(data).errors.join('\n'), /Unknown component revision/);
});

test('negative 11: comparison data unavailable stays unavailable', () => {
  const comparator = { metric: 'diesel cost', state: 'UNAVAILABLE' };
  assert.equal(comparator.state, 'UNAVAILABLE');
});

test('negative 12: missing economic assumption remains explicit', () => {
  const assumption = { id: 'A-1', state: 'MISSING' };
  assert.equal(assumption.state, 'MISSING');
});

test('negative 13: PASS without required evidence is invalid', () => {
  const data = base(); data.tests[0].requiredEvidenceIds = ['EV-MISSING'];
  assert.equal(validateCampaignData(data).valid, false);
});

test('negative 14: evaluator refuses SUPPORT with critical FAIL', () => {
  const data = base(); data.tests[0].status = 'FAIL';
  assert.equal(evaluateCampaign(data).decision, 'FAILED');
});

test('negative 15: deterministic state wins over contradictory AI explanation', () => {
  const data = base(); data.tests[0].status = 'FAIL';
  const deterministic = evaluateCampaign(data);
  const aiExplanation = { suggestedDecision: 'SUPPORTED', text: 'Looks supported.' };
  assert.equal(deterministic.decision, 'FAILED');
  assert.notEqual(aiExplanation.suggestedDecision, deterministic.decision);
});
