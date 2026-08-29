import type { MergeBlocker } from '@logichub-engineering/contracts';

export interface MergeGateInput {
  baseProjectId: string;
  headProjectId: string;
  headDescendsFromBase: boolean;
  baseIsStale: boolean;
  manifestIntegrityValid: boolean;
  artifactHashesValid: boolean;
  schemaValidationsPassed: boolean;
  kicadImportValidationPassed: boolean;
  ercHasBlockingFailures: boolean;
  drcHasBlockingFailures: boolean;
  hasBlockingConstraintViolation: boolean;
  hasUnknownRequiredValidation: boolean;
  requiredDecisionsPresent: boolean;
  requiredApprovals: number;
  approvalCount: number;
  hasUnresolvedRequestChanges: boolean;
  workingTreeClean: boolean;
  /**
   * Whether the merge operation has already run and produced a new
   * immutable revision. Leave undefined for every pre-merge evaluation
   * (including `recalculate`) -- gate 16 reports 'pending' in that case,
   * since it describes a postcondition of the merge itself and cannot be
   * decided in advance. Set true/false only when re-evaluating immediately
   * after the merge operation actually ran.
   */
  mergeProducedRevision?: boolean;
}

export type MergeGateStatus = 'pass' | 'fail' | 'pending';

export interface MergeGateCheck {
  gate: number;
  code: string;
  description: string;
  status: MergeGateStatus;
}

export interface MergeGateResult {
  eligible: boolean;
  blockers: MergeBlocker[];
  checks: MergeGateCheck[];
}

interface GateDefinition {
  gate: number;
  code: string;
  description: string;
  evaluate: (input: MergeGateInput) => MergeGateStatus;
}

const GATE_DEFINITIONS: GateDefinition[] = [
  {
    gate: 1, code: 'SAME_PROJECT', description: 'Base and head revisions belong to the same project.',
    evaluate: (i) => (i.baseProjectId === i.headProjectId ? 'pass' : 'fail'),
  },
  {
    gate: 2, code: 'ANCESTRY', description: 'Head revision descends from the declared base revision.',
    evaluate: (i) => (i.headDescendsFromBase ? 'pass' : 'fail'),
  },
  {
    gate: 3, code: 'BASE_NOT_STALE', description: 'Base revision has not become stale.',
    evaluate: (i) => (i.baseIsStale ? 'fail' : 'pass'),
  },
  {
    gate: 4, code: 'MANIFEST_INTEGRITY', description: 'Revision manifests pass integrity validation.',
    evaluate: (i) => (i.manifestIntegrityValid ? 'pass' : 'fail'),
  },
  {
    gate: 5, code: 'ARTIFACT_HASHES_VALID', description: 'Artifact hashes are valid.',
    evaluate: (i) => (i.artifactHashesValid ? 'pass' : 'fail'),
  },
  {
    gate: 6, code: 'SCHEMA_VALIDATIONS_PASS', description: 'Required schema validations pass.',
    evaluate: (i) => (i.schemaValidationsPassed ? 'pass' : 'fail'),
  },
  {
    gate: 7, code: 'KICAD_IMPORT_VALID', description: 'KiCad import validation passes.',
    evaluate: (i) => (i.kicadImportValidationPassed ? 'pass' : 'fail'),
  },
  {
    gate: 8, code: 'ERC_NO_BLOCKING_FAILURES', description: 'ERC does not contain blocking failures.',
    evaluate: (i) => (i.ercHasBlockingFailures ? 'fail' : 'pass'),
  },
  {
    gate: 9, code: 'DRC_NO_BLOCKING_FAILURES', description: 'DRC does not contain blocking failures.',
    evaluate: (i) => (i.drcHasBlockingFailures ? 'fail' : 'pass'),
  },
  {
    gate: 10, code: 'NO_BLOCKING_CONSTRAINT_VIOLATION', description: 'No blocking constraint is violated.',
    evaluate: (i) => (i.hasBlockingConstraintViolation ? 'fail' : 'pass'),
  },
  {
    gate: 11, code: 'NO_UNKNOWN_REQUIRED_VALIDATION', description: 'No required validation remains "unknown".',
    evaluate: (i) => (i.hasUnknownRequiredValidation ? 'fail' : 'pass'),
  },
  {
    gate: 12, code: 'REQUIRED_DECISIONS_PRESENT', description: 'Required decision records exist.',
    evaluate: (i) => (i.requiredDecisionsPresent ? 'pass' : 'fail'),
  },
  {
    gate: 13, code: 'REQUIRED_APPROVALS_SATISFIED', description: 'Required approval count is satisfied.',
    evaluate: (i) => (i.approvalCount >= i.requiredApprovals ? 'pass' : 'fail'),
  },
  {
    gate: 14, code: 'NO_UNRESOLVED_REQUEST_CHANGES', description: 'No active "request_changes" review remains unresolved.',
    evaluate: (i) => (i.hasUnresolvedRequestChanges ? 'fail' : 'pass'),
  },
  {
    gate: 15, code: 'WORKING_TREE_CLEAN', description: 'The repository working tree is clean.',
    evaluate: (i) => (i.workingTreeClean ? 'pass' : 'fail'),
  },
  {
    gate: 16, code: 'MERGE_PRODUCES_REVISION', description: 'The merge operation produces a new immutable revision.',
    evaluate: (i) => (i.mergeProducedRevision === undefined ? 'pending' : i.mergeProducedRevision ? 'pass' : 'fail'),
  },
];

/**
 * Pure policy evaluation over already-computed inputs (ADR-0003: review-engine
 * owns all 16 merge-gate conditions and the MergeEligibility result, but no
 * persistence, Git, or other I/O). Gates 1-15 are real preconditions and
 * gate `eligible`; gate 16 is a postcondition of the merge operation itself
 * (undecidable before the merge runs) and is reported separately as
 * 'pending' | 'pass' | 'fail', never counted toward `eligible`.
 *
 * Callers must call this again immediately before actually merging (the
 * master spec's "recalculate" requirement) -- this function has no memory of
 * a previous call, so a fresh MergeGateInput always yields a fresh result.
 */
export function evaluateMergeGates(input: MergeGateInput): MergeGateResult {
  const checks: MergeGateCheck[] = GATE_DEFINITIONS.map((def) => ({
    gate: def.gate,
    code: def.code,
    description: def.description,
    status: def.evaluate(input),
  }));

  const failingPreconditions = checks.filter((c) => c.gate <= 15 && c.status === 'fail');
  const blockers: MergeBlocker[] = failingPreconditions.map((c) => ({ code: c.code, message: c.description }));

  return {
    eligible: failingPreconditions.length === 0,
    blockers,
    checks,
  };
}
