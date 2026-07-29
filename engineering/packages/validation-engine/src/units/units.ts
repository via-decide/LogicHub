/**
 * Narrow, explicit unit-normalization layer.
 *
 * Only the units this kernel actually needs are supported. Unknown units are
 * a hard error — never a silent pass-through. Absent values are never
 * coerced to zero; callers receive a MissingInput record instead.
 */

export type Dimension =
  | 'current'
  | 'voltage'
  | 'power'
  | 'charge_capacity'
  | 'energy'
  | 'time'
  | 'temperature'
  | 'thermal_resistance'
  | 'length'
  | 'mass'
  | 'ratio'
  | 'currency_inr'
  | 'resistance'
  | 'count';

/** Canonical unit per dimension. All rule math runs in these units. */
export const CANONICAL_UNIT: Record<Dimension, string> = {
  current: 'A',
  voltage: 'V',
  power: 'W',
  charge_capacity: 'Ah',
  energy: 'Wh',
  time: 'h',
  temperature: 'degC',
  thermal_resistance: 'K/W',
  length: 'mm',
  mass: 'g',
  ratio: 'fraction',
  currency_inr: 'INR',
  resistance: 'Ohm',
  count: 'count',
};

interface UnitSpec {
  dimension: Dimension;
  /** multiplicative factor to canonical unit (after offset for temperature) */
  factor: number;
  /** additive offset applied before factor (only temperature uses this) */
  offset?: number;
}

const UNIT_TABLE: Record<string, UnitSpec> = {
  // current
  A: { dimension: 'current', factor: 1 },
  mA: { dimension: 'current', factor: 1e-3 },
  uA: { dimension: 'current', factor: 1e-6 },
  // voltage
  V: { dimension: 'voltage', factor: 1 },
  mV: { dimension: 'voltage', factor: 1e-3 },
  // power
  W: { dimension: 'power', factor: 1 },
  mW: { dimension: 'power', factor: 1e-3 },
  // charge capacity
  Ah: { dimension: 'charge_capacity', factor: 1 },
  mAh: { dimension: 'charge_capacity', factor: 1e-3 },
  // energy
  Wh: { dimension: 'energy', factor: 1 },
  mWh: { dimension: 'energy', factor: 1e-3 },
  // time
  h: { dimension: 'time', factor: 1 },
  min: { dimension: 'time', factor: 1 / 60 },
  s: { dimension: 'time', factor: 1 / 3600 },
  ms: { dimension: 'time', factor: 1 / 3_600_000 },
  // temperature (canonical degC; K converts via offset)
  degC: { dimension: 'temperature', factor: 1 },
  K: { dimension: 'temperature', factor: 1, offset: -273.15 },
  // thermal resistance
  'K/W': { dimension: 'thermal_resistance', factor: 1 },
  'degC/W': { dimension: 'thermal_resistance', factor: 1 },
  // length
  mm: { dimension: 'length', factor: 1 },
  m: { dimension: 'length', factor: 1000 },
  um: { dimension: 'length', factor: 1e-3 },
  // mass
  g: { dimension: 'mass', factor: 1 },
  kg: { dimension: 'mass', factor: 1000 },
  // ratio — percentages and fractions are distinct units, converted explicitly
  fraction: { dimension: 'ratio', factor: 1 },
  percent: { dimension: 'ratio', factor: 0.01 },
  // currency
  INR: { dimension: 'currency_inr', factor: 1 },
  // resistance
  Ohm: { dimension: 'resistance', factor: 1 },
  kOhm: { dimension: 'resistance', factor: 1000 },
  MOhm: { dimension: 'resistance', factor: 1e6 },
  // dimensionless counts
  count: { dimension: 'count', factor: 1 },
  bit: { dimension: 'count', factor: 1 },
};

export type EvidenceGrade = 'verified' | 'datasheet' | 'measured' | 'estimated' | 'unknown';

export interface Quantity {
  value: number;
  unit: string;
  provenance?: string;
  evidenceGrade?: EvidenceGrade;
}

export interface NormalizedQuantity extends Quantity {
  /** canonical unit for the dimension */
  unit: string;
  dimension: Dimension;
  originalValue: number;
  originalUnit: string;
}

export interface MissingInput {
  field: string;
  reason: string;
}

export class UnitError extends Error {
  readonly code = 'LH_VALIDATION_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'UnitError';
  }
}

export function isQuantity(value: unknown): value is Quantity {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Quantity).value === 'number' &&
    typeof (value as Quantity).unit === 'string'
  );
}

/**
 * Normalize a quantity to the canonical unit of the expected dimension.
 * Throws UnitError on unknown units or dimension mismatch. Never invents
 * values: a null/undefined input is the caller's MissingInput case.
 */
export function normalizeQuantity(q: Quantity, expected: Dimension, field: string): NormalizedQuantity {
  const spec = UNIT_TABLE[q.unit];
  if (!spec) {
    throw new UnitError(`${field}: unknown unit '${q.unit}' — silent unit mixing is prohibited`);
  }
  if (spec.dimension !== expected) {
    throw new UnitError(
      `${field}: unit '${q.unit}' has dimension '${spec.dimension}', expected '${expected}'`,
    );
  }
  if (!Number.isFinite(q.value)) {
    throw new UnitError(`${field}: non-finite value ${String(q.value)}`);
  }
  const offset = spec.offset ?? 0;
  const value = (q.value + offset) * spec.factor;
  return {
    value,
    unit: CANONICAL_UNIT[expected],
    dimension: expected,
    originalValue: q.value,
    originalUnit: q.unit,
    ...(q.provenance !== undefined ? { provenance: q.provenance } : {}),
    ...(q.evidenceGrade !== undefined ? { evidenceGrade: q.evidenceGrade } : {}),
  };
}

/**
 * Resolve an optional quantity: returns the normalized quantity, or records a
 * MissingInput and returns null. NEVER substitutes zero.
 */
export function resolveQuantity(
  q: Quantity | null | undefined,
  expected: Dimension,
  field: string,
  missing: MissingInput[],
): NormalizedQuantity | null {
  if (q === null || q === undefined) {
    missing.push({ field, reason: 'required input absent — not defaulted to zero' });
    return null;
  }
  return normalizeQuantity(q, expected, field);
}

/** Weakest evidence grade across a set of quantities (missing counts as unknown). */
export function weakestEvidenceGrade(quantities: Array<Quantity | null | undefined>): EvidenceGrade {
  const order: EvidenceGrade[] = ['verified', 'datasheet', 'measured', 'estimated', 'unknown'];
  let worst = 0;
  for (const q of quantities) {
    const grade: EvidenceGrade = q?.evidenceGrade ?? 'unknown';
    const idx = order.indexOf(grade);
    if (idx > worst) worst = idx;
  }
  return order[worst];
}
