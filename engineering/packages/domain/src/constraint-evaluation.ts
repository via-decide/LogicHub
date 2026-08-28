import type { Constraint, ConstraintEvaluation, EngineeringObject } from '@logichub-engineering/contracts';
import type { DeltaRecord } from '@logichub-engineering/repository-engine';

/**
 * See docs/decisions/adr-0004-constraint-evaluation.md for why this is a
 * small, scoped, deterministic evaluator rather than a reuse of
 * validation-engine's SEC-* rules. It recognizes a fixed, documented set of
 * machine-checkable expression shapes; anything else honestly reports
 * `requires_validation` rather than fabricating a pass.
 *
 * `object_must_exist` / `object_must_not_exist` / `property_equals`
 * `semanticKey` values must be `EngineeringObject.semanticKey` as
 * kicad-adapter's extractors produce it (e.g. `component:D2`) -- this is a
 * DIFFERENT namespace from the semantic ids repository-engine's diff uses in
 * `DeltaRecord.oldSemanticId`/`newSemanticId` (e.g. `schematic::D2`), which
 * is what `no_delta_type`'s `semanticKeys` filters against instead. Using
 * the wrong namespace for a given expression kind makes the object/delta
 * lookup silently miss, not throw -- getting this right matters.
 */
export type ConstraintExpression =
  | { kind: 'object_must_exist'; semanticKey: string }
  | { kind: 'object_must_not_exist'; semanticKey: string }
  | { kind: 'no_delta_type'; deltaTypes: string[]; semanticKeys?: string[] }
  | { kind: 'property_equals'; semanticKey: string; property: string };

export interface ConstraintEvaluationOutcome {
  constraintId: string;
  evaluation: ConstraintEvaluation;
  reason: string;
}

export function parseConstraintExpression(raw: unknown): ConstraintExpression | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (obj.kind === 'object_must_exist' || obj.kind === 'object_must_not_exist') {
    return typeof obj.semanticKey === 'string' ? { kind: obj.kind, semanticKey: obj.semanticKey } : null;
  }
  if (obj.kind === 'no_delta_type') {
    if (!Array.isArray(obj.deltaTypes) || !obj.deltaTypes.every((d) => typeof d === 'string')) return null;
    const semanticKeys = Array.isArray(obj.semanticKeys) && obj.semanticKeys.every((k) => typeof k === 'string')
      ? (obj.semanticKeys as string[])
      : undefined;
    return { kind: 'no_delta_type', deltaTypes: obj.deltaTypes as string[], semanticKeys };
  }
  if (obj.kind === 'property_equals') {
    return typeof obj.semanticKey === 'string' && typeof obj.property === 'string'
      ? { kind: 'property_equals', semanticKey: obj.semanticKey, property: obj.property }
      : null;
  }
  return null;
}

function violationOrWarning(constraint: Constraint): ConstraintEvaluation {
  return constraint.severity === 'blocking' ? 'violation' : 'warning';
}

export function evaluateConstraint(
  constraint: Constraint,
  targetObjects: EngineeringObject[],
  deltas: DeltaRecord[]
): ConstraintEvaluationOutcome {
  const expr = parseConstraintExpression(constraint.expression);
  if (!expr) {
    return {
      constraintId: constraint.id,
      evaluation: 'requires_validation',
      reason: 'Constraint expression is not in a recognized machine-checkable shape; requires manual or tool-assisted validation.',
    };
  }

  switch (expr.kind) {
    case 'object_must_exist': {
      const found = targetObjects.some((o) => o.semanticKey === expr.semanticKey);
      return found
        ? { constraintId: constraint.id, evaluation: 'pass', reason: `${expr.semanticKey} is present in the target revision.` }
        : {
            constraintId: constraint.id,
            evaluation: violationOrWarning(constraint),
            reason: `${expr.semanticKey} is required but absent from the target revision.`,
          };
    }
    case 'object_must_not_exist': {
      const found = targetObjects.some((o) => o.semanticKey === expr.semanticKey);
      return found
        ? {
            constraintId: constraint.id,
            evaluation: violationOrWarning(constraint),
            reason: `${expr.semanticKey} must not be present but was found in the target revision.`,
          }
        : { constraintId: constraint.id, evaluation: 'pass', reason: `${expr.semanticKey} is absent as required.` };
    }
    case 'no_delta_type': {
      const offending = deltas.filter(
        (d) =>
          expr.deltaTypes.includes(d.deltaType) &&
          (!expr.semanticKeys || expr.semanticKeys.some((k) => d.oldSemanticId === k || d.newSemanticId === k))
      );
      return offending.length === 0
        ? { constraintId: constraint.id, evaluation: 'pass', reason: 'No disallowed delta types touched the constrained scope.' }
        : {
            constraintId: constraint.id,
            evaluation: violationOrWarning(constraint),
            reason: `${offending.length} disallowed delta(s) touched the constrained scope: ${offending.map((d) => d.deltaType).join(', ')}.`,
          };
    }
    case 'property_equals': {
      const obj = targetObjects.find((o) => o.semanticKey === expr.semanticKey);
      if (!obj) {
        return {
          constraintId: constraint.id,
          evaluation: 'unknown',
          reason: `${expr.semanticKey} was not found in the target revision; cannot evaluate ${expr.property}.`,
        };
      }
      const actual = obj.properties[expr.property];
      const matches = JSON.stringify(actual) === JSON.stringify(constraint.expected);
      return matches
        ? { constraintId: constraint.id, evaluation: 'pass', reason: `${expr.property} matches the expected value.` }
        : {
            constraintId: constraint.id,
            evaluation: violationOrWarning(constraint),
            reason: `${expr.property} is ${JSON.stringify(actual)}, expected ${JSON.stringify(constraint.expected)}.`,
          };
    }
  }
}

export function evaluateConstraints(
  constraints: Constraint[],
  targetObjects: EngineeringObject[],
  deltas: DeltaRecord[]
): ConstraintEvaluationOutcome[] {
  return constraints.map((constraint) => evaluateConstraint(constraint, targetObjects, deltas));
}

/** True when any evaluated constraint is both `severity: 'blocking'` and `evaluation: 'violation'` — the real boolean merge gate #10 reads. */
export function hasBlockingConstraintViolation(
  constraints: Constraint[],
  outcomes: ConstraintEvaluationOutcome[]
): boolean {
  const blockingIds = new Set(constraints.filter((c) => c.severity === 'blocking').map((c) => c.id));
  return outcomes.some((o) => blockingIds.has(o.constraintId) && o.evaluation === 'violation');
}
