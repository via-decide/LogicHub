import { describe, it, expect } from 'vitest';
import { evaluateMergeGates, type MergeGateInput } from '../src/merge-gates.js';

function allGreenInput(): MergeGateInput {
  return {
    baseProjectId: 'proj-1',
    headProjectId: 'proj-1',
    headDescendsFromBase: true,
    baseIsStale: false,
    manifestIntegrityValid: true,
    artifactHashesValid: true,
    schemaValidationsPassed: true,
    kicadImportValidationPassed: true,
    ercHasBlockingFailures: false,
    drcHasBlockingFailures: false,
    hasBlockingConstraintViolation: false,
    hasUnknownRequiredValidation: false,
    requiredDecisionsPresent: true,
    requiredApprovals: 1,
    approvalCount: 1,
    hasUnresolvedRequestChanges: false,
    workingTreeClean: true,
  };
}

describe('evaluateMergeGates: all green', () => {
  it('is eligible with no blockers when every precondition passes', () => {
    const result = evaluateMergeGates(allGreenInput());
    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.checks.filter((c) => c.gate <= 15).every((c) => c.status === 'pass')).toBe(true);
  });

  it('reports gate 16 as pending pre-merge, and does not count it toward eligibility', () => {
    const result = evaluateMergeGates(allGreenInput());
    const gate16 = result.checks.find((c) => c.gate === 16);
    expect(gate16?.status).toBe('pending');
    expect(result.eligible).toBe(true);
  });
});

// Each of gates 1-15: flipping it alone blocks merge; every other gate staying
// green means it alone is responsible for `eligible: false`.
const singleGateOverrides: Array<{ gate: number; code: string; overrides: Partial<MergeGateInput> }> = [
  { gate: 1, code: 'SAME_PROJECT', overrides: { headProjectId: 'proj-2' } },
  { gate: 2, code: 'ANCESTRY', overrides: { headDescendsFromBase: false } },
  { gate: 3, code: 'BASE_NOT_STALE', overrides: { baseIsStale: true } },
  { gate: 4, code: 'MANIFEST_INTEGRITY', overrides: { manifestIntegrityValid: false } },
  { gate: 5, code: 'ARTIFACT_HASHES_VALID', overrides: { artifactHashesValid: false } },
  { gate: 6, code: 'SCHEMA_VALIDATIONS_PASS', overrides: { schemaValidationsPassed: false } },
  { gate: 7, code: 'KICAD_IMPORT_VALID', overrides: { kicadImportValidationPassed: false } },
  { gate: 8, code: 'ERC_NO_BLOCKING_FAILURES', overrides: { ercHasBlockingFailures: true } },
  { gate: 9, code: 'DRC_NO_BLOCKING_FAILURES', overrides: { drcHasBlockingFailures: true } },
  { gate: 10, code: 'NO_BLOCKING_CONSTRAINT_VIOLATION', overrides: { hasBlockingConstraintViolation: true } },
  { gate: 11, code: 'NO_UNKNOWN_REQUIRED_VALIDATION', overrides: { hasUnknownRequiredValidation: true } },
  { gate: 12, code: 'REQUIRED_DECISIONS_PRESENT', overrides: { requiredDecisionsPresent: false } },
  { gate: 13, code: 'REQUIRED_APPROVALS_SATISFIED', overrides: { approvalCount: 0 } },
  { gate: 14, code: 'NO_UNRESOLVED_REQUEST_CHANGES', overrides: { hasUnresolvedRequestChanges: true } },
  { gate: 15, code: 'WORKING_TREE_CLEAN', overrides: { workingTreeClean: false } },
];

describe('evaluateMergeGates: each gate blocks alone and only when it fails', () => {
  for (const { gate, code, overrides } of singleGateOverrides) {
    it(`gate ${gate} (${code}) blocks merge when it alone fails`, () => {
      const result = evaluateMergeGates({ ...allGreenInput(), ...overrides });
      expect(result.eligible).toBe(false);
      expect(result.blockers.map((b) => b.code)).toEqual([code]);
      const failing = result.checks.filter((c) => c.status === 'fail');
      expect(failing.map((c) => c.gate)).toEqual([gate]);
    });

    it(`gate ${gate} (${code}) does not block merge when passing with every other gate green`, () => {
      const result = evaluateMergeGates(allGreenInput());
      const check = result.checks.find((c) => c.gate === gate);
      expect(check?.status).toBe('pass');
    });
  }
});

describe('evaluateMergeGates: multiple failures', () => {
  it('reports a blocker for every failing gate, not just the first', () => {
    const result = evaluateMergeGates({
      ...allGreenInput(),
      baseIsStale: true,
      ercHasBlockingFailures: true,
      hasUnresolvedRequestChanges: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.blockers.map((b) => b.code).sort()).toEqual(
      ['BASE_NOT_STALE', 'ERC_NO_BLOCKING_FAILURES', 'NO_UNRESOLVED_REQUEST_CHANGES'].sort()
    );
  });
});

describe('evaluateMergeGates: gate 16 postcondition', () => {
  it('reports pass once the merge has actually produced a revision', () => {
    const result = evaluateMergeGates({ ...allGreenInput(), mergeProducedRevision: true });
    expect(result.checks.find((c) => c.gate === 16)?.status).toBe('pass');
  });

  it('reports fail if the merge ran but did not produce a revision, without affecting eligible (a pre-merge concept)', () => {
    const result = evaluateMergeGates({ ...allGreenInput(), mergeProducedRevision: false });
    expect(result.checks.find((c) => c.gate === 16)?.status).toBe('fail');
    expect(result.eligible).toBe(true);
  });
});

describe('evaluateMergeGates: recalculation has no memory of prior calls', () => {
  it('a PR that was eligible flips to ineligible once its base becomes stale, and back again once resolved', () => {
    const input = allGreenInput();
    expect(evaluateMergeGates(input).eligible).toBe(true);

    const afterBaseAdvanced = evaluateMergeGates({ ...input, baseIsStale: true });
    expect(afterBaseAdvanced.eligible).toBe(false);
    expect(afterBaseAdvanced.blockers.map((b) => b.code)).toContain('BASE_NOT_STALE');

    const afterRebase = evaluateMergeGates({ ...input, baseIsStale: false });
    expect(afterRebase.eligible).toBe(true);
  });
});
