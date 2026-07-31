import type { TelemetryPayload, TelemetryStream } from '../telemetry/telemetry.schema.js';

/**
 * Integrity checks that run before any rule is evaluated.
 *
 * A digest proves the payload arrived as it was sealed. It does not prove the
 * payload describes a real inspection. These checks look at the shape of the
 * data for the signatures of a stream that was assembled rather than captured:
 * frames replayed, frames reordered, nodes missing.
 *
 * None of them is conclusive on its own — a determined forger can produce a
 * well-ordered fabricated stream — and this file does not pretend otherwise.
 * What they do is make the cheap attacks fail, and make the expensive ones
 * leave evidence.
 */

export const INTEGRITY_ERRORS = {
  replayedFrame: 'ERR_REPLAYED_FRAME',
  nonMonotonicSequence: 'ERR_SEQUENCE_NOT_MONOTONIC',
  nonMonotonicTime: 'ERR_TIMESTAMP_NOT_MONOTONIC',
  incompleteTelemetry: 'FAILED_INCOMPLETE_TELEMETRY',
  duplicateNode: 'ERR_DUPLICATE_NODE',
} as const;

export type IntegrityErrorCode = (typeof INTEGRITY_ERRORS)[keyof typeof INTEGRITY_ERRORS];

export interface IntegrityViolation {
  code: IntegrityErrorCode;
  nodeId: string | null;
  detail: string;
}

export interface IntegrityReport {
  ok: boolean;
  violations: IntegrityViolation[];
}

/**
 * Every node the inspection plan requires, checked against what arrived.
 *
 * Three of four capacitive nodes is not 75% of an inspection. It is an
 * inspection that did not happen, and it halts the pipeline rather than being
 * scored on what is present — otherwise the cheapest way to pass is to omit the
 * node that would have failed.
 */
export function checkCompleteness(
  payload: TelemetryPayload,
  requiredNodeIds: readonly string[],
): IntegrityViolation[] {
  const present = new Set(payload.streams.map(stream => stream.nodeId));
  const missing = requiredNodeIds.filter(id => !present.has(id)).sort();

  if (missing.length === 0) return [];

  return [{
    code: INTEGRITY_ERRORS.incompleteTelemetry,
    nodeId: null,
    detail:
      `${present.size} of ${requiredNodeIds.length} required nodes reported. `
      + `Missing: ${missing.join(', ')}. A partial inspection is not a partial pass.`,
  }];
}

/** Two streams claiming the same node make the winner depend on array order. */
export function checkDistinctNodes(payload: TelemetryPayload): IntegrityViolation[] {
  const seen = new Set<string>();
  const violations: IntegrityViolation[] = [];

  for (const stream of payload.streams) {
    if (seen.has(stream.nodeId)) {
      violations.push({
        code: INTEGRITY_ERRORS.duplicateNode,
        nodeId: stream.nodeId,
        detail: `Node ${stream.nodeId} submitted more than one stream.`,
      });
    }
    seen.add(stream.nodeId);
  }

  return violations;
}

/**
 * Frame ordering within one stream.
 *
 * A capture is monotonic in both sequence and time. A repeated sequence number
 * is a frame that was played twice; a sequence that goes backwards is a stream
 * that was spliced. Both are refused.
 *
 * Timestamps are checked separately and allowed to be *equal* — real nodes emit
 * several frames inside one millisecond — but never to go backwards. This is
 * why `sequence` exists at all: it distinguishes a fast node from a replayed one
 * in a way a timestamp cannot.
 */
export function checkFrameOrdering(stream: TelemetryStream): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];
  const seenSequences = new Set<number>();

  let previousSequence: number | null = null;
  let previousTimestamp: number | null = null;

  for (const frame of stream.frames) {
    if (seenSequences.has(frame.sequence)) {
      violations.push({
        code: INTEGRITY_ERRORS.replayedFrame,
        nodeId: stream.nodeId,
        detail:
          `Sequence ${frame.sequence} appears more than once. A frame replayed into `
          + 'a stream is an old reading presented as a new one.',
      });
    }
    seenSequences.add(frame.sequence);

    if (previousSequence !== null && frame.sequence <= previousSequence) {
      violations.push({
        code: INTEGRITY_ERRORS.nonMonotonicSequence,
        nodeId: stream.nodeId,
        detail:
          `Sequence went ${previousSequence} -> ${frame.sequence}. Capture order is `
          + 'monotonic; a stream that goes backwards was assembled, not recorded.',
      });
    }

    if (previousTimestamp !== null && frame.timestampMs < previousTimestamp) {
      violations.push({
        code: INTEGRITY_ERRORS.nonMonotonicTime,
        nodeId: stream.nodeId,
        detail:
          `Timestamp went ${previousTimestamp} -> ${frame.timestampMs} ms. `
          + 'Equal timestamps are allowed; earlier ones are not.',
      });
    }

    previousSequence = frame.sequence;
    previousTimestamp = frame.timestampMs;
  }

  return violations;
}

/** Every integrity check, in one pass, with findings sorted for stable reports. */
export function checkIntegrity(
  payload: TelemetryPayload,
  requiredNodeIds: readonly string[],
): IntegrityReport {
  const violations = [
    ...checkCompleteness(payload, requiredNodeIds),
    ...checkDistinctNodes(payload),
    ...payload.streams.flatMap((s: TelemetryStream) => checkFrameOrdering(s)),
  ].sort((a, b) => {
    const left = `${a.code}:${a.nodeId ?? ''}:${a.detail}`;
    const right = `${b.code}:${b.nodeId ?? ''}:${b.detail}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });

  return { ok: violations.length === 0, violations };
}
