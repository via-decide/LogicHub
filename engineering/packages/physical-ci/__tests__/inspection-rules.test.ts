import { describe, it, expect } from 'vitest';
import {
  RULE_ERRORS,
  evaluateRuleset,
  parseRuleset,
} from '../src/rules/inspection-rules.js';

const YAML = `
rules:
  - property: diameter_mm
    target: 25.00
    tolerance: 0.05
  - property: weight_grams
    target: 142.5
    tolerance: 0.2
  - property: imu_6dof_drift
    max_allowed: 0.02
`;

const ruleset = () => parseRuleset(YAML);

const inSpec = { diameter_mm: 25.0, weight_grams: 142.5, imu_6dof_drift: 0.004 };

describe('YAML ruleset parsing', () => {
  it('parses the three rule forms the spec uses', () => {
    expect(ruleset().rules).toHaveLength(3);
  });

  it('refuses a rule with neither tolerance nor ceiling', () => {
    // A rule with no bound would pass every value, which is worse than no rule
    // at all because it looks like coverage.
    expect(() => parseRuleset('rules:\n  - property: diameter_mm\n'))
      .toThrow(RULE_ERRORS.malformedRuleset);
  });

  it('refuses a rule carrying both a tolerance and a ceiling', () => {
    expect(() => parseRuleset(
      'rules:\n  - property: d\n    target: 1\n    tolerance: 0.1\n    max_allowed: 2\n',
    )).toThrow(RULE_ERRORS.malformedRuleset);
  });

  it('refuses a negative tolerance, which describes an empty window', () => {
    expect(() => parseRuleset('rules:\n  - property: d\n    target: 1\n    tolerance: -0.1\n'))
      .toThrow(RULE_ERRORS.malformedRuleset);
  });

  it('refuses the same property constrained twice', () => {
    // Two rules for one property make the outcome depend on evaluation order.
    expect(() => parseRuleset(
      'rules:\n  - property: d\n    target: 1\n    tolerance: 0.1\n'
      + '  - property: d\n    max_allowed: 5\n',
    )).toThrow(/constrained twice/);
  });

  it('refuses an empty ruleset', () => {
    expect(() => parseRuleset('rules: []')).toThrow(RULE_ERRORS.malformedRuleset);
  });

  it('refuses text that is not YAML at all', () => {
    expect(() => parseRuleset('rules: [unclosed')).toThrow(RULE_ERRORS.malformedRuleset);
  });
});

describe('rule evaluation — binary, inclusive, deterministic', () => {
  it('passes a part comfortably inside every bound', () => {
    const result = evaluateRuleset(ruleset(), inSpec);
    expect(result.passed).toBe(true);
    expect(result.codes).toEqual([]);
  });

  it('passes a part sitting exactly on the upper limit', () => {
    // 25.00 + 0.05 is 25.049999999999997 in binary floating point. A naive
    // comparison rejects a part that is exactly on its inclusive limit.
    const result = evaluateRuleset(ruleset(), { ...inSpec, diameter_mm: 25.05 });
    expect(result.passed).toBe(true);
  });

  it('passes a part sitting exactly on the lower limit', () => {
    const result = evaluateRuleset(ruleset(), { ...inSpec, diameter_mm: 24.95 });
    expect(result.passed).toBe(true);
  });

  it('passes a reading exactly on a ceiling', () => {
    const result = evaluateRuleset(ruleset(), { ...inSpec, imu_6dof_drift: 0.02 });
    expect(result.passed).toBe(true);
  });

  it('fails 25.0500001 with ERR_TOLERANCE_BREACH', () => {
    const result = evaluateRuleset(ruleset(), { ...inSpec, diameter_mm: 25.0500001 });

    expect(result.passed).toBe(false);
    expect(result.codes).toEqual([RULE_ERRORS.toleranceBreach]);
  });

  it('treats a hair out of spec exactly as it treats a catastrophe', () => {
    const hair = evaluateRuleset(ruleset(), { ...inSpec, diameter_mm: 25.0500001 });
    const catastrophe = evaluateRuleset(ruleset(), { ...inSpec, diameter_mm: 90 });

    // Same verdict, same code. There is no severity scale, because a severity
    // scale is where "close enough" gets in.
    expect(hair.passed).toBe(catastrophe.passed);
    expect(hair.codes).toEqual(catastrophe.codes);
  });

  it('fails a ceiling breach with its own code', () => {
    const result = evaluateRuleset(ruleset(), { ...inSpec, imu_6dof_drift: 0.0200001 });
    expect(result.codes).toEqual([RULE_ERRORS.ceilingBreach]);
  });

  it('fails a property the ruleset requires and nobody measured', () => {
    const { diameter_mm: _omitted, ...partial } = inSpec;
    const result = evaluateRuleset(ruleset(), partial);

    expect(result.passed).toBe(false);
    expect(result.codes).toEqual([RULE_ERRORS.missingProperty]);
    // The wording matters: this is the trap the whole project guards against.
    expect(result.findings.find(f => f.property === 'diameter_mm')?.detail)
      .toContain('not a reading inside tolerance');
  });

  it('refuses NaN rather than letting a false comparison read as a pass', () => {
    const result = evaluateRuleset(ruleset(), { ...inSpec, weight_grams: Number.NaN });

    expect(result.passed).toBe(false);
    expect(result.codes).toEqual([RULE_ERRORS.nonFinite]);
  });

  it('refuses Infinity too', () => {
    const result = evaluateRuleset(ruleset(), { ...inSpec, weight_grams: Number.POSITIVE_INFINITY });
    expect(result.codes).toEqual([RULE_ERRORS.nonFinite]);
  });

  it('reports every failing rule, not only the first', () => {
    const result = evaluateRuleset(ruleset(), {
      diameter_mm: 30, weight_grams: 200, imu_6dof_drift: 5,
    });

    expect(result.findings.filter(f => !f.passed)).toHaveLength(3);
  });

  it('ignores measurements the ruleset does not constrain', () => {
    // Extra data is not a failure. It is simply not what was agreed.
    const result = evaluateRuleset(ruleset(), { ...inSpec, colour_temperature_k: 6500 });
    expect(result.passed).toBe(true);
  });

  it('reports findings in a stable order regardless of input order', () => {
    const forward = evaluateRuleset(ruleset(), inSpec);
    const reversed = evaluateRuleset(ruleset(), {
      imu_6dof_drift: inSpec.imu_6dof_drift,
      weight_grams: inSpec.weight_grams,
      diameter_mm: inSpec.diameter_mm,
    });

    expect(reversed.findings.map(f => f.property)).toEqual(forward.findings.map(f => f.property));
  });

  it('states the bounds it used, so a vendor can check the arithmetic', () => {
    const finding = evaluateRuleset(ruleset(), inSpec)
      .findings.find(f => f.property === 'diameter_mm');

    expect(finding?.lowerBound).toBe(24.95);
    expect(finding?.upperBound).toBe(25.05);
  });

  it('gives a ceiling rule no lower bound rather than a fabricated zero', () => {
    const finding = evaluateRuleset(ruleset(), inSpec)
      .findings.find(f => f.property === 'imu_6dof_drift');

    // A ceiling says nothing about how low is acceptable. Reporting 0 would be
    // inventing half a rule.
    expect(finding?.lowerBound).toBeNull();
    expect(finding?.upperBound).toBe(0.02);
  });

  it('is deterministic across repeated evaluation', () => {
    const a = evaluateRuleset(ruleset(), inSpec);
    const b = evaluateRuleset(ruleset(), inSpec);
    expect(a).toEqual(b);
  });

  it('never returns a state between passed and failed', () => {
    for (const diameter of [24.9, 24.95, 25, 25.05, 25.1]) {
      const result = evaluateRuleset(ruleset(), { ...inSpec, diameter_mm: diameter });
      expect(typeof result.passed).toBe('boolean');
    }
  });
});
