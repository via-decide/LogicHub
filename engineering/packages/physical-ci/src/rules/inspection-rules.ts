import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

/**
 * The inspection ruleset, as a vendor and a buyer both read it.
 *
 * Rules are written in YAML because two parties have to agree on them before
 * any part is made, and a YAML file can be reviewed in a pull request by a
 * person who does not write TypeScript.
 *
 * ```yaml
 * rules:
 *   - property: diameter_mm
 *     target: 25.00
 *     tolerance: 0.05      # strictly [24.95, 25.05]
 *   - property: imu_6dof_drift
 *     max_allowed: 0.02
 * ```
 *
 * Two forms, and only two:
 *   - `target` + `tolerance` — a two-sided window, inclusive at both ends.
 *   - `max_allowed`          — a one-sided ceiling, inclusive.
 *
 * A rule with neither is a malformed ruleset, not a rule that passes everything.
 */

export const RULE_ERRORS = {
  toleranceBreach: 'ERR_TOLERANCE_BREACH',
  ceilingBreach: 'ERR_CEILING_BREACH',
  missingProperty: 'ERR_PROPERTY_ABSENT',
  malformedRuleset: 'ERR_RULESET_MALFORMED',
  nonFinite: 'ERR_VALUE_NOT_FINITE',
} as const;

export type RuleErrorCode = (typeof RULE_ERRORS)[keyof typeof RULE_ERRORS];

const ToleranceRuleSchema = z.object({
  property: z.string().min(1),
  target: z.number().finite(),
  tolerance: z.number().finite().nonnegative(),
  max_allowed: z.undefined().optional(),
});

const CeilingRuleSchema = z.object({
  property: z.string().min(1),
  max_allowed: z.number().finite(),
  target: z.undefined().optional(),
  tolerance: z.undefined().optional(),
});

export const InspectionRuleSchema = z.union([ToleranceRuleSchema, CeilingRuleSchema]);
export type InspectionRule = z.infer<typeof InspectionRuleSchema>;

export const RulesetSchema = z.object({
  rules: z.array(InspectionRuleSchema).min(1),
});
export type Ruleset = z.infer<typeof RulesetSchema>;

/**
 * Decimal places the *bound* is normalised to.
 *
 * The float problem lives entirely in computing the bound: `25.00 + 0.05` is
 * `25.049999999999997`, a different double from the literal `25.05`, so a part
 * measuring exactly its inclusive limit would be rejected by a naive
 * comparison. Rounding the arithmetic result to a decimal scale recovers the
 * bound the ruleset actually wrote down.
 *
 * The **reading is never rounded**. Rounding it would widen every tolerance by
 * half a unit of this scale, so 25.0500001 would quietly become 25.05 and pass
 * a rule it breaches. The whole point is that a hair outside is outside, so the
 * bound is cleaned up and the measurement is left exactly as it was taken.
 */
const BOUND_SCALE = 6;

/** Normalise a computed bound back to the decimal figure the ruleset wrote. */
function roundBound(value: number): number {
  const factor = 10 ** BOUND_SCALE;
  // Number.EPSILON nudges the half-way cases that would otherwise round down
  // because their binary representation sits a hair below the boundary.
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

/** Rounding used only for reporting an overshoot, never for deciding one. */
function reportable(value: number): number {
  const factor = 10 ** 9;
  return Math.round(value * factor) / factor;
}

export interface RuleFinding {
  property: string;
  passed: boolean;
  code: RuleErrorCode | null;
  observed: number | null;
  /** Inclusive bounds. A ceiling rule has a null lower bound. */
  lowerBound: number | null;
  upperBound: number | null;
  detail: string;
}

export interface RulesetEvaluation {
  /** True only when every rule passed. There is no partial credit. */
  passed: boolean;
  findings: RuleFinding[];
  /** Distinct failure codes, sorted, for a machine to branch on. */
  codes: RuleErrorCode[];
}

/** Parse a ruleset from YAML text, throwing with a usable message if it is not one. */
export function parseRuleset(yaml: string): Ruleset {
  let document: unknown;
  try {
    document = parseYaml(yaml);
  } catch (error) {
    throw new Error(
      `${RULE_ERRORS.malformedRuleset}: the ruleset is not valid YAML — `
      + `${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsed = RulesetSchema.safeParse(document);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue: z.ZodIssue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .sort()
      .join('; ');
    throw new Error(
      `${RULE_ERRORS.malformedRuleset}: ${issues}. A rule needs either `
      + 'target+tolerance or max_allowed; a rule with neither would pass everything.',
    );
  }

  const seen = new Set<string>();
  for (const rule of parsed.data.rules) {
    if (seen.has(rule.property)) {
      throw new Error(
        `${RULE_ERRORS.malformedRuleset}: "${rule.property}" is constrained twice. `
        + 'Two rules for one property make the outcome depend on evaluation order.',
      );
    }
    seen.add(rule.property);
  }

  return parsed.data;
}

/**
 * Evaluate measured properties against a ruleset.
 *
 * Binary. A reading is inside its bounds or it is not, and 0.0000001 outside is
 * outside. Nothing here returns a warning, because a warning is a state someone
 * eventually learns to click past.
 *
 * A property the ruleset requires and the measurements do not contain is a
 * failure, not a skip. Absent is not "within tolerance".
 */
export function evaluateRuleset(
  ruleset: Ruleset,
  measured: Readonly<Record<string, number>>,
): RulesetEvaluation {
  const findings: RuleFinding[] = [];

  // Sorted so the report reads the same regardless of YAML or object ordering.
  const rules = [...ruleset.rules].sort((a, b) => (a.property < b.property ? -1 : 1));

  for (const rule of rules) {
    const observed = measured[rule.property];

    if (observed === undefined) {
      findings.push({
        property: rule.property,
        passed: false,
        code: RULE_ERRORS.missingProperty,
        observed: null,
        ...boundsOf(rule),
        detail:
          `"${rule.property}" is required by the ruleset and was not measured. `
          + 'An absent reading is not a reading inside tolerance.',
      });
      continue;
    }

    if (!Number.isFinite(observed)) {
      findings.push({
        property: rule.property,
        passed: false,
        code: RULE_ERRORS.nonFinite,
        observed: null,
        ...boundsOf(rule),
        detail:
          `"${rule.property}" arrived as ${String(observed)}. A comparison against `
          + 'NaN is false in both directions, so it is refused rather than evaluated.',
      });
      continue;
    }

    findings.push(evaluateRule(rule, observed));
  }

  const codes = [...new Set(findings.filter(f => !f.passed).map(f => f.code!))].sort();

  return {
    passed: findings.every(finding => finding.passed),
    findings,
    codes,
  };
}

/**
 * One rule reduced to the bounds it actually enforces.
 *
 * Both YAML forms collapse to the same thing: an inclusive upper bound, and a
 * lower bound that is null for a ceiling. Normalising once means the comparison
 * below has a single shape and no union to narrow.
 */
interface NormalisedRule {
  property: string;
  lowerBound: number | null;
  upperBound: number;
}

function normalise(rule: InspectionRule): NormalisedRule {
  const ceiling = (rule as { max_allowed?: number }).max_allowed;
  if (typeof ceiling === 'number') {
    return { property: rule.property, lowerBound: null, upperBound: roundBound(ceiling) };
  }

  const { target, tolerance } = rule as { target: number; tolerance: number };
  return {
    property: rule.property,
    lowerBound: roundBound(target - tolerance),
    upperBound: roundBound(target + tolerance),
  };
}

function boundsOf(rule: InspectionRule): { lowerBound: number | null; upperBound: number | null } {
  const { lowerBound, upperBound } = normalise(rule);
  return { lowerBound, upperBound };
}

function evaluateRule(rule: InspectionRule, observed: number): RuleFinding {
  const { property, lowerBound, upperBound } = normalise(rule);
  // Deliberately not rounded. See BOUND_SCALE.
  const value = observed;

  if (lowerBound === null) {
    const passed = value <= upperBound;
    return {
      property,
      passed,
      code: passed ? null : RULE_ERRORS.ceilingBreach,
      observed: value,
      lowerBound,
      upperBound,
      detail: passed
        ? `${value} is at or below the ${upperBound} ceiling.`
        : `${value} exceeds the ${upperBound} ceiling by ${reportable(value - upperBound)}.`,
    };
  }

  const passed = value >= lowerBound && value <= upperBound;
  const excess = value > upperBound ? value - upperBound : lowerBound - value;

  return {
    property,
    passed,
    code: passed ? null : RULE_ERRORS.toleranceBreach,
    observed: value,
    lowerBound,
    upperBound,
    detail: passed
      ? `${value} is inside [${lowerBound}, ${upperBound}].`
      : `${value} is outside [${lowerBound}, ${upperBound}] by ${reportable(excess)}.`,
  };
}
