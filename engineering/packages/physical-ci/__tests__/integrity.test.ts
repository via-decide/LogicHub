import { describe, it, expect } from 'vitest';
import {
  checkCompleteness,
  checkDistinctNodes,
  checkFrameOrdering,
  checkIntegrity,
  INTEGRITY_ERRORS,
} from '../src/pipeline/integrity.js';
import { payload, stream } from '../src/telemetry/fixtures.js';

/**
 * `pipeline/integrity.ts`'s functions are exercised indirectly through
 * `merge-gate.test.ts`'s "adversarial telemetry" suite (via `runPipeline`),
 * but were never unit-tested in isolation — this covers `checkCompleteness`,
 * `checkDistinctNodes`, and `checkFrameOrdering` directly, plus
 * `checkIntegrity`'s aggregation/sorting across simultaneous violations,
 * which the pipeline-level tests don't exercise since they each trigger one
 * failure mode at a time.
 */

describe('checkCompleteness', () => {
  it('reports nothing when every required node is present', () => {
    const p = payload([
      stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 1 } }),
      stream({ nodeId: 'b', nodeKind: 'scale', unit: 'g', values: { y: 1 } }),
    ]);
    expect(checkCompleteness(p, ['a', 'b'])).toEqual([]);
  });

  it('names every missing node, not just the first', () => {
    const p = payload([
      stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 1 } }),
    ]);
    const violations = checkCompleteness(p, ['a', 'b', 'c']);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe(INTEGRITY_ERRORS.incompleteTelemetry);
    expect(violations[0].detail).toContain('b');
    expect(violations[0].detail).toContain('c');
  });

  it('does not require a node the plan never asked for', () => {
    const p = payload([
      stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 1 } }),
      stream({ nodeId: 'extra', nodeKind: 'imu', unit: 'deg', values: { z: 1 } }),
    ]);
    expect(checkCompleteness(p, ['a'])).toEqual([]);
  });
});

describe('checkDistinctNodes', () => {
  it('reports nothing when every node id is unique', () => {
    const p = payload([
      stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 1 } }),
      stream({ nodeId: 'b', nodeKind: 'scale', unit: 'g', values: { y: 1 } }),
    ]);
    expect(checkDistinctNodes(p)).toEqual([]);
  });

  it('flags the second and any later stream from a repeated node, not the first', () => {
    const p = payload([
      stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 1 } }),
      stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 2 } }),
      stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 3 } }),
    ]);
    const violations = checkDistinctNodes(p);
    expect(violations).toHaveLength(2);
    expect(violations.every(v => v.code === INTEGRITY_ERRORS.duplicateNode)).toBe(true);
    expect(violations.every(v => v.nodeId === 'a')).toBe(true);
  });
});

describe('checkFrameOrdering', () => {
  it('reports nothing for a monotonic stream', () => {
    const s = stream({ nodeId: 'a', nodeKind: 'imu', unit: 'deg', values: { x: 1 }, frameCount: 4 });
    expect(checkFrameOrdering(s)).toEqual([]);
  });

  it('reports a replayed sequence exactly once per repeat, not once per occurrence pair', () => {
    const s = {
      nodeId: 'a', nodeKind: 'imu' as const, nodeRevision: 'fw', unit: 'deg',
      frames: [
        { sequence: 0, timestampMs: 0, values: { x: 1 } },
        { sequence: 0, timestampMs: 40, values: { x: 1 } },
        { sequence: 1, timestampMs: 80, values: { x: 1 } },
      ],
    };
    const violations = checkFrameOrdering(s);
    expect(violations.filter(v => v.code === INTEGRITY_ERRORS.replayedFrame)).toHaveLength(1);
  });

  it('reports both a sequence and a timestamp violation when a frame is spliced in backwards', () => {
    const s = {
      nodeId: 'a', nodeKind: 'imu' as const, nodeRevision: 'fw', unit: 'deg',
      frames: [
        { sequence: 5, timestampMs: 200, values: { x: 1 } },
        { sequence: 2, timestampMs: 100, values: { x: 1 } },
      ],
    };
    const violations = checkFrameOrdering(s);
    expect(violations.map(v => v.code).sort()).toEqual(
      [INTEGRITY_ERRORS.nonMonotonicSequence, INTEGRITY_ERRORS.nonMonotonicTime].sort(),
    );
  });

  it('does not flag a single-frame stream', () => {
    const s = {
      nodeId: 'a', nodeKind: 'imu' as const, nodeRevision: 'fw', unit: 'deg',
      frames: [{ sequence: 0, timestampMs: 0, values: { x: 1 } }],
    };
    expect(checkFrameOrdering(s)).toEqual([]);
  });
});

describe('checkIntegrity — aggregation across simultaneous violations', () => {
  it('reports a missing node AND a duplicate node AND a replayed frame together, not just the first found', () => {
    const p = payload([
      stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 1 } }),
      stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 2 } }),
      {
        nodeId: 'b', nodeKind: 'imu', nodeRevision: 'fw', unit: 'deg',
        frames: [
          { sequence: 0, timestampMs: 0, values: { y: 1 } },
          { sequence: 0, timestampMs: 40, values: { y: 1 } },
        ],
      },
    ]);

    // Required a third node ('c') that never reported at all.
    const report = checkIntegrity(p, ['a', 'b', 'c']);
    const codes = new Set(report.violations.map(v => v.code));

    expect(report.ok).toBe(false);
    expect(codes.has(INTEGRITY_ERRORS.incompleteTelemetry)).toBe(true);
    expect(codes.has(INTEGRITY_ERRORS.duplicateNode)).toBe(true);
    expect(codes.has(INTEGRITY_ERRORS.replayedFrame)).toBe(true);
  });

  it('is ok with zero violations across multiple clean streams', () => {
    const p = payload([
      stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 1 }, frameCount: 5 }),
      stream({ nodeId: 'b', nodeKind: 'scale', unit: 'g', values: { y: 1 }, frameCount: 2 }),
      stream({ nodeId: 'c', nodeKind: 'imu', unit: 'deg', values: { z: 1 }, frameCount: 3 }),
    ]);
    const report = checkIntegrity(p, ['a', 'b', 'c']);
    expect(report).toEqual({ ok: true, violations: [] });
  });

  it('sorts findings the same way regardless of stream order in the payload', () => {
    const nodeA = stream({ nodeId: 'a', nodeKind: 'micrometer', unit: 'mm', values: { x: 1 } });
    const nodeB = stream({ nodeId: 'b', nodeKind: 'scale', unit: 'g', values: { y: 1 } });

    const forward = checkIntegrity(payload([nodeA, nodeA, nodeB]), ['a', 'b']);
    const backward = checkIntegrity(payload([nodeB, nodeA, nodeA]), ['a', 'b']);

    expect(forward.violations).toEqual(backward.violations);
  });
});
