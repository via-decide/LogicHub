import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseProduct, parseCase, evaluateCase } from '../src/kernel/evaluator.js';
import { hashRuleResult, canonicalBytes } from '../src/kernel/canonical.js';
import { compareWithOutcome, isFalsePass, type DocumentedOutcome } from '../src/kernel/compare.js';
import { RULE_REGISTRY, getRule } from '../src/rules/registry.js';
import { normalizeQuantity, resolveQuantity, type MissingInput } from '../src/units/units.js';
import { deriveConfidence } from '../src/confidence.js';
import { combineStatuses, type RuleResultStatus } from '../src/contracts/rule-result.schema.js';
import { sha256Hex } from '../src/util/hash.js';
import { jcsCanonicalize } from '../src/util/jcs.js';

const PRODUCT_PATH = resolve(__dirname, '../../..', 'reference-products/sovereign-educational-console/product.json');
const CASES_DIR = resolve(__dirname, '../../..', 'reference-products/sovereign-educational-console/cases');

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf-8'));
}

// ---------------------------------------------------------------------------
// Unit normalization
// ---------------------------------------------------------------------------

describe('unit normalization', () => {
  it('converts mA to A', () => {
    const q = normalizeQuantity({ value: 500, unit: 'mA', provenance: 'test', evidenceGrade: 'estimated' }, 'current');
    expect(q.value).toBeCloseTo(0.5);
    expect(q.unit).toBe('A');
  });

  it('converts mAh to Ah', () => {
    const q = normalizeQuantity({ value: 1200, unit: 'mAh', provenance: 'test', evidenceGrade: 'estimated' }, 'charge_capacity');
    expect(q.value).toBeCloseTo(1.2);
    expect(q.unit).toBe('Ah');
  });

  it('keeps h as canonical for time dimension', () => {
    const q = normalizeQuantity({ value: 4, unit: 'h', provenance: 'test', evidenceGrade: 'estimated' }, 'time');
    expect(q.value).toBeCloseTo(4);
    expect(q.unit).toBe('h');
  });

  it('converts percent to fraction', () => {
    const q = normalizeQuantity({ value: 80, unit: 'percent', provenance: 'test', evidenceGrade: 'estimated' }, 'ratio');
    expect(q.value).toBeCloseTo(0.8);
    expect(q.unit).toBe('fraction');
  });

  it('throws on unknown unit', () => {
    expect(() =>
      normalizeQuantity({ value: 1, unit: 'furlongs', provenance: 'test', evidenceGrade: 'unknown' }, 'length'),
    ).toThrow();
  });

  it('resolveQuantity returns null for null input and pushes MissingInput', () => {
    const missing: MissingInput[] = [];
    const result = resolveQuantity(null, 'current', 'test.field', missing);
    expect(result).toBeNull();
    expect(missing).toHaveLength(1);
    expect(missing[0].field).toBe('test.field');
  });
});

// ---------------------------------------------------------------------------
// Confidence derivation
// ---------------------------------------------------------------------------

describe('confidence derivation', () => {
  it('yields insufficient_evidence when inputs are missing', () => {
    const c = deriveConfidence({ requiredInputGrades: ['estimated'], missingRequiredCount: 1 });
    expect(c.confidenceClass).toBe('insufficient_evidence');
  });

  it('yields deterministic_estimated_inputs for all estimated', () => {
    const c = deriveConfidence({ requiredInputGrades: ['estimated', 'estimated', 'estimated'], missingRequiredCount: 0 });
    expect(c.confidenceClass).toBe('deterministic_estimated_inputs');
  });

  it('yields deterministic_verified_inputs for all verified/datasheet/measured', () => {
    const c = deriveConfidence({ requiredInputGrades: ['verified', 'datasheet', 'measured'], missingRequiredCount: 0 });
    expect(c.confidenceClass).toBe('deterministic_verified_inputs');
  });

  it('always produces a non-empty rationale', () => {
    const c = deriveConfidence({ requiredInputGrades: ['estimated'], missingRequiredCount: 0 });
    expect(c.confidenceRationale.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Status combination
// ---------------------------------------------------------------------------

describe('combineStatuses', () => {
  it('unknown outranks warning', () => {
    expect(combineStatuses(['warning', 'unknown'])).toBe('unknown');
  });

  it('fail outranks everything except error', () => {
    expect(combineStatuses(['pass', 'fail', 'warning'])).toBe('fail');
  });

  it('error outranks everything', () => {
    expect(combineStatuses(['pass', 'fail', 'error'])).toBe('error');
  });

  it('empty array → unknown (safe default)', () => {
    expect(combineStatuses([])).toBe('unknown');
  });

  it('all pass → pass', () => {
    expect(combineStatuses(['pass', 'pass'])).toBe('pass');
  });

  it('requires_validation does not outrank unknown', () => {
    expect(combineStatuses(['requires_validation', 'unknown'])).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Canonical hashing: determinism
// ---------------------------------------------------------------------------

describe('canonical hashing', () => {
  it('produces identical hash for identical object', () => {
    const obj = { b: 2, a: 1, c: [3, 2, 1] };
    const h1 = sha256Hex(jcsCanonicalize(obj));
    const h2 = sha256Hex(jcsCanonicalize(obj));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('property order does not affect canonical bytes', () => {
    const a = { x: 1, y: 2 };
    const b = { y: 2, x: 1 };
    expect(jcsCanonicalize(a)).toBe(jcsCanonicalize(b));
  });
});

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

describe('rule registry', () => {
  it('has exactly 5 rules', () => {
    expect(RULE_REGISTRY).toHaveLength(5);
  });

  it('all rule IDs are unique', () => {
    const ids = RULE_REGISTRY.map(r => r.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getRule returns undefined for unknown id', () => {
    expect(getRule('NONEXISTENT-001')).toBeUndefined();
  });

  it('every rule has a valid definition', () => {
    for (const rule of RULE_REGISTRY) {
      expect(rule.definition.ruleId).toBe(rule.ruleId);
      expect(rule.definition.ruleVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(rule.definition.requiredInputs.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Compare with outcome
// ---------------------------------------------------------------------------

describe('compareWithOutcome', () => {
  it('synthetic material → not_applicable', () => {
    const outcome: DocumentedOutcome = { description: 'test', evidenceClass: 'synthetic', observedFailure: null };
    expect(compareWithOutcome('pass', outcome)).toBe('not_applicable');
  });

  it('narrative claim → insufficient_evidence', () => {
    const outcome: DocumentedOutcome = { description: 'test', evidenceClass: 'narrative_claim', observedFailure: true };
    expect(compareWithOutcome('fail', outcome)).toBe('insufficient_evidence');
  });

  it('design record → insufficient_evidence', () => {
    const outcome: DocumentedOutcome = { description: 'test', evidenceClass: 'design_record_no_outcome', observedFailure: null };
    expect(compareWithOutcome('pass', outcome)).toBe('insufficient_evidence');
  });

  it('documented failure + kernel fail → detects_documented_failure', () => {
    const outcome: DocumentedOutcome = { description: 'test', evidenceClass: 'documented_physical_outcome', observedFailure: true };
    expect(compareWithOutcome('fail', outcome)).toBe('detects_documented_failure');
  });

  it('documented failure + kernel pass → misses_documented_failure (false pass)', () => {
    const outcome: DocumentedOutcome = { description: 'test', evidenceClass: 'documented_physical_outcome', observedFailure: true };
    expect(compareWithOutcome('pass', outcome)).toBe('misses_documented_failure');
  });

  it('documented success + kernel pass → agrees_with_documented_outcome', () => {
    const outcome: DocumentedOutcome = { description: 'test', evidenceClass: 'documented_physical_outcome', observedFailure: false };
    expect(compareWithOutcome('pass', outcome)).toBe('agrees_with_documented_outcome');
  });

  it('documented success + kernel fail → false_warning', () => {
    const outcome: DocumentedOutcome = { description: 'test', evidenceClass: 'documented_physical_outcome', observedFailure: false };
    expect(compareWithOutcome('fail', outcome)).toBe('false_warning');
  });

  it('documented outcome with null observedFailure throws', () => {
    const outcome: DocumentedOutcome = { description: 'test', evidenceClass: 'documented_physical_outcome', observedFailure: null };
    expect(() => compareWithOutcome('pass', outcome)).toThrow('documented_physical_outcome requires observedFailure');
  });

  it('isFalsePass detects kernel-pass-vs-failure', () => {
    const outcome: DocumentedOutcome = { description: 'test', evidenceClass: 'documented_physical_outcome', observedFailure: true };
    expect(isFalsePass('pass', outcome)).toBe(true);
    expect(isFalsePass('fail', outcome)).toBe(false);
    expect(isFalsePass('pass', { ...outcome, observedFailure: false })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reference case: full evaluation
// ---------------------------------------------------------------------------

describe('reference-v0 full evaluation', () => {
  it('parses product and case, evaluates all 5 rules', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const caseData = parseCase(await loadJson(join(CASES_DIR, 'reference-v0.json')));
    const doc = evaluateCase(product, caseData);

    expect(doc.schemaVersion).toBe('0.1.0');
    expect(doc.productId).toBe('sovereign-educational-console');
    expect(doc.ruleResults).toHaveLength(5);
    expect(doc.documentHash).toMatch(/^[a-f0-9]{64}$/);

    for (const rr of doc.ruleResults) {
      expect(rr.resultHash).toMatch(/^[a-f0-9]{64}$/);
      expect(rr.ruleId).toBeTruthy();
      expect(rr.ruleVersion).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('unknown never treated as pass: missing inputs never produce pass status', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const caseData = parseCase(await loadJson(join(CASES_DIR, 'reference-v0.json')));
    const doc = evaluateCase(product, caseData);

    for (const rr of doc.ruleResults) {
      if (rr.unknowns.length > 0) {
        expect(rr.status).not.toBe('pass');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 10x determinism test
// ---------------------------------------------------------------------------

describe('10x determinism', () => {
  it('produces byte-identical canonical output across 10 runs', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const caseData = await loadJson(join(CASES_DIR, 'reference-v0.json'));

    const hashes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const pc = parseCase(JSON.parse(JSON.stringify(caseData)));
      const doc = evaluateCase(product, pc);
      const canonical = canonicalBytes(doc);
      hashes.push(sha256Hex(canonical.toString('utf-8')));
    }

    const unique = new Set(hashes);
    expect(unique.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Schema validation: malformed inputs
// ---------------------------------------------------------------------------

describe('malformed input rejection', () => {
  it('rejects product with missing productId', () => {
    expect(() => parseProduct({ schemaVersion: '0.1.0', productRevision: 'v0.1' })).toThrow();
  });

  it('rejects case with wrong schemaVersion', () => {
    expect(() => parseCase({ schemaVersion: '99.0.0', caseId: 'x' })).toThrow();
  });

  it('rejects case with unknown rule ID at schema level', async () => {
    const raw = await loadJson(join(CASES_DIR, 'reference-v0.json')) as Record<string, unknown>;
    raw['rules'] = ['NONEXISTENT-001'];
    expect(() => parseCase(raw)).toThrow();
  });

  it('rejects product/case mismatch on productId', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const raw = await loadJson(join(CASES_DIR, 'reference-v0.json')) as Record<string, unknown>;
    const intent = raw['intent'] as Record<string, unknown>;
    intent['productId'] = 'wrong-product';
    const pc = parseCase(raw);
    expect(() => evaluateCase(product, pc)).toThrow('wrong-product');
  });
});

// ---------------------------------------------------------------------------
// Missing input section → unknown, never pass
// ---------------------------------------------------------------------------

describe('absent input section → unknown status', () => {
  it('evaluating a case with no power inputs yields unknown for that rule', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const raw = await loadJson(join(CASES_DIR, 'reference-v0.json')) as Record<string, unknown>;
    raw['rules'] = ['SEC-POWER-THERMAL-001'];
    const inputs = raw['inputs'] as Record<string, unknown>;
    delete inputs['power'];
    const pc = parseCase(raw);
    const doc = evaluateCase(product, pc);

    expect(doc.ruleResults).toHaveLength(1);
    expect(doc.ruleResults[0].status).toBe('unknown');
    expect(doc.ruleResults[0].ruleId).toBe('SEC-POWER-THERMAL-001');
  });

  it('evaluating a case with no optical inputs yields unknown', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const raw = await loadJson(join(CASES_DIR, 'reference-v0.json')) as Record<string, unknown>;
    raw['rules'] = ['SEC-OPTICAL-CLASSIFICATION-001'];
    const inputs = raw['inputs'] as Record<string, unknown>;
    delete inputs['optical'];
    const pc = parseCase(raw);
    const doc = evaluateCase(product, pc);

    expect(doc.ruleResults).toHaveLength(1);
    expect(doc.ruleResults[0].status).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Individual rule boundary values
// ---------------------------------------------------------------------------

describe('power rule: boundary — under-capacity battery', () => {
  it('tiny battery yields fail on runtime', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const raw = await loadJson(join(CASES_DIR, 'reference-v0.json')) as Record<string, unknown>;
    raw['rules'] = ['SEC-POWER-THERMAL-001'];
    raw['caseId'] = 'synth-tiny-battery';
    const inputs = raw['inputs'] as Record<string, unknown>;
    const power = inputs['power'] as Record<string, unknown>;
    const battery = power['battery'] as Record<string, unknown>;
    battery['nominalCapacity'] = { value: 100, unit: 'mAh', provenance: 'test', evidenceGrade: 'estimated' };
    const pc = parseCase(raw);
    const doc = evaluateCase(product, pc);

    expect(doc.ruleResults[0].status).not.toBe('pass');
    const runtimeCheck = doc.ruleResults[0].checks.find((c: { check: string }) => c.check === 'runtime');
    expect(runtimeCheck).toBeDefined();
    expect(runtimeCheck!.status).toBe('fail');
  });
});

describe('interface rule: output-output conflict', () => {
  it('two outputs on same pin yield fail', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const raw = await loadJson(join(CASES_DIR, 'reference-v0.json')) as Record<string, unknown>;
    raw['rules'] = ['SEC-INTERFACE-INTEGRITY-001'];
    raw['caseId'] = 'synth-out-out-conflict';
    const inputs = raw['inputs'] as Record<string, unknown>;
    const iface = inputs['interface'] as Record<string, unknown>;
    const connections = iface['connections'] as Array<Record<string, unknown>>;
    connections.push({
      id: 'conflict-test',
      fromPin: 'GPIO5',
      fromDirection: 'out',
      fromDomain: { value: 3.3, unit: 'V', provenance: 'test', evidenceGrade: 'estimated' },
      toPin: 'GPIO6',
      toDirection: 'out',
      toDomain: { value: 3.3, unit: 'V', provenance: 'test', evidenceGrade: 'estimated' },
    });
    const pc = parseCase(raw);
    const doc = evaluateCase(product, pc);

    const result = doc.ruleResults[0];
    expect(['fail', 'warning']).toContain(result.status);
  });
});

describe('mechanical rule: always requires_validation for strap/drop', () => {
  it('strap anchors untested → requires_validation', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const raw = await loadJson(join(CASES_DIR, 'reference-v0.json')) as Record<string, unknown>;
    raw['rules'] = ['SEC-MECHANICAL-RUGGEDNESS-001'];
    const pc = parseCase(raw);
    const doc = evaluateCase(product, pc);

    const result = doc.ruleResults[0];
    const strapCheck = result.checks.find((c: { check: string }) => c.check === 'strap-anchors');
    if (strapCheck) {
      expect(strapCheck.status).toBe('requires_validation');
    }
    const dropCheck = result.checks.find((c: { check: string }) => c.check === 'drop-resistance');
    if (dropCheck) {
      expect(dropCheck.status).toBe('requires_validation');
    }
  });
});

describe('economics rule: missing margin inputs → refuses margin language', () => {
  it('null assemblyHours/laborRate/etc yields unknown or insufficient', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const raw = await loadJson(join(CASES_DIR, 'reference-v0.json')) as Record<string, unknown>;
    raw['rules'] = ['SEC-MANUFACTURING-ECONOMICS-001'];
    const pc = parseCase(raw);
    const doc = evaluateCase(product, pc);

    const result = doc.ruleResults[0];
    expect(result.status).not.toBe('pass');
    expect(result.unknowns.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Result hash stability
// ---------------------------------------------------------------------------

describe('result hash stability', () => {
  it('hashRuleResult produces consistent hashes', async () => {
    const product = parseProduct(await loadJson(PRODUCT_PATH));
    const raw1 = await loadJson(join(CASES_DIR, 'reference-v0.json'));
    const raw2 = await loadJson(join(CASES_DIR, 'reference-v0.json'));

    const pc1 = parseCase(raw1);
    const pc2 = parseCase(raw2);
    const doc1 = evaluateCase(product, pc1);
    const doc2 = evaluateCase(product, pc2);

    for (let i = 0; i < doc1.ruleResults.length; i++) {
      expect(doc1.ruleResults[i].resultHash).toBe(doc2.ruleResults[i].resultHash);
    }
  });
});
