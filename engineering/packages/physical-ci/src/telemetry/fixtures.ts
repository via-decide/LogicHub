import { sealPayload, telemetryDigest } from './digest.js';
import type { Submission, TelemetryPayload, TelemetryStream } from './telemetry.schema.js';

/**
 * Mock physical payloads.
 *
 * These are **fixtures**, not evidence. Nothing here was measured. They exist so
 * the pipeline can be exercised against valid, boundary and malicious shapes
 * without a bench, and they are named so nobody mistakes one for a real
 * inspection record: every serial number begins with `FIXTURE-`.
 *
 * That prefix is asserted in the tests. A fixture that could be mistaken for a
 * historical measurement is exactly the fabrication this project refuses.
 */

const FIXTURE_SERIAL_PREFIX = 'FIXTURE-';
const FIXTURE_CAPTURED_AT = '2026-03-01T09:00:00.000Z';

export interface StreamSpec {
  nodeId: string;
  nodeKind: TelemetryStream['nodeKind'];
  unit: string;
  /** Channel readings for the final frame — what the rules will see. */
  values: Record<string, number>;
  frameCount?: number;
}

/**
 * A well-formed stream with monotonic sequence and time.
 *
 * Earlier frames carry the same channels at slightly different values so the
 * stream looks like a settling measurement rather than one value repeated,
 * which would itself trip the replay heuristics if they were stricter.
 */
export function stream(spec: StreamSpec): TelemetryStream {
  const count = spec.frameCount ?? 3;
  const frames = Array.from({ length: count }, (_, index) => {
    const isLast = index === count - 1;
    const values: Record<string, number> = {};
    for (const [channel, value] of Object.entries(spec.values)) {
      // Settle towards the final value. The last frame is exact.
      values[channel] = isLast ? value : round(value * (1 - 0.0005 * (count - 1 - index)));
    }
    return { sequence: index, timestampMs: index * 40, values };
  });

  return {
    nodeId: spec.nodeId,
    nodeKind: spec.nodeKind,
    nodeRevision: 'fixture-fw-0.1.0',
    unit: spec.unit,
    frames,
  };
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function payload(
  streams: TelemetryStream[],
  overrides: Partial<TelemetryPayload> = {},
): TelemetryPayload {
  return {
    submissionId: 'SUB-FIXTURE-0001',
    vendorId: 'vendor-fixture',
    partNumber: 'CARTRIDGE-SHELL-UPPER',
    serialNumber: `${FIXTURE_SERIAL_PREFIX}0001`,
    capturedAt: FIXTURE_CAPTURED_AT,
    streams,
    ...overrides,
  };
}

/** A payload sealed with the digest it actually hashes to. */
export function sealed(value: TelemetryPayload): Submission {
  return sealPayload(value);
}

/**
 * A payload sealed with a digest that does not match it.
 *
 * Models the case the whole scheme exists to catch: bytes altered after
 * sealing, or a digest lifted from a different submission.
 */
export function tampered(value: TelemetryPayload, mutate: (p: TelemetryPayload) => TelemetryPayload): Submission {
  const original = telemetryDigest(value);
  return { payload: mutate(structuredClone(value)), declaredDigest: original };
}

// --------------------------------------------------------------- named cases

/** Everything comfortably inside tolerance. */
export function passingSubmission(): Submission {
  return sealed(payload([
    stream({
      nodeId: 'micrometer-01',
      nodeKind: 'micrometer',
      unit: 'mm',
      values: { diameter_mm: 25.0 },
    }),
    stream({
      nodeId: 'scale-01',
      nodeKind: 'scale',
      unit: 'g',
      values: { weight_grams: 142.5 },
    }),
    stream({
      nodeId: 'imu-01',
      nodeKind: 'imu',
      unit: 'deg',
      values: { imu_6dof_drift: 0.004 },
    }),
  ]));
}

/**
 * Exactly on the upper limit.
 *
 * 25.05 with a target of 25.00 and tolerance 0.05 must pass — the window is
 * inclusive. This is the case naive floating-point comparison gets wrong,
 * because `25.00 + 0.05` is `25.049999999999997`.
 */
export function boundarySubmission(): Submission {
  return sealed(payload([
    stream({ nodeId: 'micrometer-01', nodeKind: 'micrometer', unit: 'mm', values: { diameter_mm: 25.05 } }),
    stream({ nodeId: 'scale-01', nodeKind: 'scale', unit: 'g', values: { weight_grams: 142.7 } }),
    stream({ nodeId: 'imu-01', nodeKind: 'imu', unit: 'deg', values: { imu_6dof_drift: 0.02 } }),
  ]));
}

/** A hair outside. Must fail exactly as hard as a part that is 5 mm out. */
export function hairOutsideSubmission(): Submission {
  return sealed(payload([
    stream({ nodeId: 'micrometer-01', nodeKind: 'micrometer', unit: 'mm', values: { diameter_mm: 25.0500001 } }),
    stream({ nodeId: 'scale-01', nodeKind: 'scale', unit: 'g', values: { weight_grams: 142.5 } }),
    stream({ nodeId: 'imu-01', nodeKind: 'imu', unit: 'deg', values: { imu_6dof_drift: 0.004 } }),
  ]));
}

/** Three of four required nodes reported. */
export function incompleteSubmission(): Submission {
  return sealed(payload([
    stream({ nodeId: 'micrometer-01', nodeKind: 'micrometer', unit: 'mm', values: { diameter_mm: 25.0 } }),
    stream({ nodeId: 'scale-01', nodeKind: 'scale', unit: 'g', values: { weight_grams: 142.5 } }),
    stream({ nodeId: 'imu-01', nodeKind: 'imu', unit: 'deg', values: { imu_6dof_drift: 0.004 } }),
  ]));
}

/** A stream with one frame played twice. */
export function replayedSubmission(): Submission {
  const good = stream({
    nodeId: 'imu-01', nodeKind: 'imu', unit: 'deg', values: { imu_6dof_drift: 0.004 },
  });
  const frames = [...good.frames, good.frames[1]!];
  return sealed(payload([
    stream({ nodeId: 'micrometer-01', nodeKind: 'micrometer', unit: 'mm', values: { diameter_mm: 25.0 } }),
    stream({ nodeId: 'scale-01', nodeKind: 'scale', unit: 'g', values: { weight_grams: 142.5 } }),
    { ...good, frames },
  ]));
}

/** A stream whose frames arrive out of order. */
export function reorderedSubmission(): Submission {
  const good = stream({
    nodeId: 'imu-01', nodeKind: 'imu', unit: 'deg', values: { imu_6dof_drift: 0.004 }, frameCount: 4,
  });
  const frames = [good.frames[0]!, good.frames[2]!, good.frames[1]!, good.frames[3]!];
  return sealed(payload([
    stream({ nodeId: 'micrometer-01', nodeKind: 'micrometer', unit: 'mm', values: { diameter_mm: 25.0 } }),
    stream({ nodeId: 'scale-01', nodeKind: 'scale', unit: 'g', values: { weight_grams: 142.5 } }),
    { ...good, frames },
  ]));
}

export const FIXTURE_NODE_IDS = ['micrometer-01', 'scale-01', 'imu-01'] as const;

/** The four-node plan, used to demonstrate a partial submission halting. */
export const FOUR_NODE_PLAN = [
  'micrometer-01', 'scale-01', 'imu-01', 'capacitive-01',
] as const;

export { FIXTURE_SERIAL_PREFIX };
