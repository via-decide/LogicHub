import type { RuleResult, CheckFinding, TraceStep, RuleResultStatus } from '../contracts/rule-result.schema.js';
import { combineStatuses } from '../contracts/rule-result.schema.js';
import type { ConfidenceAssessment } from '../confidence.js';
import type { MissingInput } from '../units/units.js';

export type UnhashedRuleResult = Omit<RuleResult, 'resultHash'>;

/** Deterministic result assembly: arrays sorted where order is not semantic. */
export function buildResult(options: {
  ruleId: string;
  ruleVersion: string;
  inputs: Record<string, unknown>;
  inputProvenance: Record<string, string>;
  assumptions: string[];
  procedure: string[];
  trace: TraceStep[];
  thresholds: Record<string, unknown>;
  checks: CheckFinding[];
  metrics: Record<string, number | string | null>;
  confidence: ConfidenceAssessment;
  unknowns: MissingInput[];
  warnings: string[];
  failureModes: string[];
  requiredTests: string[];
  affectedObjects: string[];
  evidenceReferences: string[];
  /** overrides the combined check status only if MORE severe */
  statusFloor?: RuleResultStatus;
}): UnhashedRuleResult {
  const combined = combineStatuses(options.checks.map(c => c.status));
  const status = options.statusFloor !== undefined
    ? combineStatuses([combined, options.statusFloor])
    : combined;

  return {
    schemaVersion: '0.1.0',
    ruleId: options.ruleId,
    ruleVersion: options.ruleVersion,
    inputs: options.inputs,
    inputProvenance: options.inputProvenance,
    assumptions: [...options.assumptions].sort(),
    procedure: options.procedure,
    trace: options.trace,
    thresholds: options.thresholds,
    checks: [...options.checks].sort((a, b) => a.check.localeCompare(b.check)),
    metrics: options.metrics,
    status,
    confidenceClass: options.confidence.confidenceClass,
    confidenceRationale: options.confidence.confidenceRationale,
    unknowns: [...options.unknowns].sort((a, b) => a.field.localeCompare(b.field)),
    warnings: [...options.warnings].sort(),
    failureModes: [...options.failureModes].sort(),
    requiredTests: [...options.requiredTests].sort(),
    affectedObjects: [...options.affectedObjects].sort(),
    evidenceReferences: [...options.evidenceReferences].sort(),
  };
}

/** Round to a fixed decimal precision so canonical output is byte-stable. */
export function round(value: number, decimals = 6): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
