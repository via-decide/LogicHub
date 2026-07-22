import { describe, it, expect } from 'vitest';
import {
  buildReplayDocument, materializeCapabilityState,
  applyReplay, verifyReplay,
} from '../../src/semdiff/replay-builder.js';
import type { DeltaRecord, ReplayOperation } from '../../src/semdiff/types.js';
import { makeFingerprint, makeExport, makeSoftwareSurface, makeConstraint, makeDecision } from '../helpers.js';

function makeDeltaWithReplay(op: ReplayOperation): DeltaRecord {
  return {
    schemaVersion: '0.1.0',
    deltaType: 'IMPLEMENTATION_CHANGED',
    domain: 'software',
    recordId: `record_${op.objectId}`,
    oldSemanticId: null,
    newSemanticId: null,
    oldSemanticHash: null,
    newSemanticHash: null,
    oldNormalizedValue: null,
    newNormalizedValue: null,
    affectedNodeIds: [],
    supportingEdgeIds: [],
    evidenceSourcePaths: [],
    classificationBasis: 'deterministic_parser',
    replayOperation: op,
    reviewDomains: [],
    validationImplications: [],
  };
}

describe('buildReplayDocument', () => {
  it('orders operations: removes → moves → replaces → adds', () => {
    const deltas: DeltaRecord[] = [
      makeDeltaWithReplay({ operation: 'add', objectId: 'z_add', expectedOldHash: null, expectedAbsent: true }),
      makeDeltaWithReplay({ operation: 'remove', objectId: 'a_remove', expectedOldHash: 'hash' }),
      makeDeltaWithReplay({ operation: 'replace', objectId: 'm_replace', expectedOldHash: 'old' }),
      makeDeltaWithReplay({ operation: 'move', objectId: 'b_move', expectedOldHash: null, oldObjectId: 'b_old', newObjectId: 'b_new' }),
    ];

    const base = makeFingerprint();
    const proposed = makeFingerprint();
    const doc = buildReplayDocument(deltas, base, proposed);

    const ops = doc.operations.map(o => o.operation);
    const removeIdx = ops.indexOf('remove');
    const moveIdx = ops.indexOf('move');
    const replaceIdx = ops.indexOf('replace');
    const addIdx = ops.indexOf('add');

    expect(removeIdx).toBeLessThan(moveIdx);
    expect(moveIdx).toBeLessThan(replaceIdx);
    expect(replaceIdx).toBeLessThan(addIdx);
  });

  it('includes correct operation count', () => {
    const deltas = [
      makeDeltaWithReplay({ operation: 'add', objectId: 'a', expectedOldHash: null }),
      makeDeltaWithReplay({ operation: 'add', objectId: 'b', expectedOldHash: null }),
    ];
    const doc = buildReplayDocument(deltas, makeFingerprint(), makeFingerprint());
    expect(doc.operationCount).toBe(2);
    expect(doc.operations).toHaveLength(2);
  });

  it('includes base and target descriptor hashes', () => {
    const base = makeFingerprint({ descriptorHash: 'base_hash' });
    const proposed = makeFingerprint({ descriptorHash: 'proposed_hash' });
    const doc = buildReplayDocument([], base, proposed);
    expect(doc.baseDescriptorHash).toBe('base_hash');
    expect(doc.targetDescriptorHash).toBe('proposed_hash');
  });

  it('computes deterministic replay hash', () => {
    const deltas = [
      makeDeltaWithReplay({ operation: 'add', objectId: 'x', expectedOldHash: null }),
    ];
    const d1 = buildReplayDocument(deltas, makeFingerprint(), makeFingerprint());
    const d2 = buildReplayDocument(deltas, makeFingerprint(), makeFingerprint());
    expect(d1.replayHash).toBe(d2.replayHash);
    expect(d1.replayHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('materializeCapabilityState', () => {
  it('extracts software exports', () => {
    const fp = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('a.ts', {
          exportedSymbols: [
            makeExport('fn1', { bodyHash: 'h1' }),
            makeExport('fn2', { bodyHash: 'h2' }),
          ],
        }),
      ],
    });
    const state = materializeCapabilityState(fp);
    expect(state.objects.size).toBe(2);
    expect(state.objects.get('software::test.ts::export::fn1')?.semanticHash).toBe('h1');
  });

  it('extracts constraint objects', () => {
    const fp = makeFingerprint({
      constraintSurface: {
        constraints: [makeConstraint('c1', { semanticHash: 'ch1' })],
      },
    });
    const state = materializeCapabilityState(fp);
    expect(state.objects.has('constraint::c1')).toBe(true);
    expect(state.objects.get('constraint::c1')?.semanticHash).toBe('ch1');
  });

  it('extracts decision objects', () => {
    const fp = makeFingerprint({
      decisionSurface: {
        decisions: [makeDecision('d1', { selectedOptionHash: 'dh1' })],
      },
    });
    const state = materializeCapabilityState(fp);
    expect(state.objects.has('decision::d1')).toBe(true);
    expect(state.objects.get('decision::d1')?.semanticHash).toBe('dh1');
  });
});

describe('applyReplay', () => {
  it('applies add operations', () => {
    const base = { objects: new Map<string, { semanticHash: string }>() };
    const ops: ReplayOperation[] = [
      {
        operation: 'add', objectId: 'obj1', expectedOldHash: null,
        expectedAbsent: true,
        newObject: { semanticId: 'obj1', semanticHash: 'hash1' },
      },
    ];
    const { state, errors } = applyReplay(base, ops);
    expect(errors).toHaveLength(0);
    expect(state.objects.has('obj1')).toBe(true);
    expect(state.objects.get('obj1')?.semanticHash).toBe('hash1');
  });

  it('applies remove operations', () => {
    const base = {
      objects: new Map([['obj1', { semanticHash: 'hash1' }]]),
    };
    const ops: ReplayOperation[] = [
      { operation: 'remove', objectId: 'obj1', expectedOldHash: 'hash1' },
    ];
    const { state, errors } = applyReplay(base, ops);
    expect(errors).toHaveLength(0);
    expect(state.objects.has('obj1')).toBe(false);
  });

  it('applies replace operations', () => {
    const base = {
      objects: new Map([['obj1', { semanticHash: 'old_hash' }]]),
    };
    const ops: ReplayOperation[] = [
      {
        operation: 'replace', objectId: 'obj1', expectedOldHash: 'old_hash',
        newObject: { semanticId: 'obj1', semanticHash: 'new_hash' },
      },
    ];
    const { state, errors } = applyReplay(base, ops);
    expect(errors).toHaveLength(0);
    expect(state.objects.get('obj1')?.semanticHash).toBe('new_hash');
  });

  it('applies move operations', () => {
    const base = {
      objects: new Map([['old_id', { semanticHash: 'hash1' }]]),
    };
    const ops: ReplayOperation[] = [
      {
        operation: 'move', objectId: 'old_id', expectedOldHash: null,
        oldObjectId: 'old_id', newObjectId: 'new_id',
      },
    ];
    const { state, errors } = applyReplay(base, ops);
    expect(errors).toHaveLength(0);
    expect(state.objects.has('old_id')).toBe(false);
    expect(state.objects.has('new_id')).toBe(true);
  });

  it('reports error on remove of non-existent object', () => {
    const base = { objects: new Map<string, { semanticHash: string }>() };
    const ops: ReplayOperation[] = [
      { operation: 'remove', objectId: 'missing', expectedOldHash: null },
    ];
    const { errors } = applyReplay(base, ops);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('not found');
  });

  it('reports error on hash mismatch for remove', () => {
    const base = {
      objects: new Map([['obj1', { semanticHash: 'actual' }]]),
    };
    const ops: ReplayOperation[] = [
      { operation: 'remove', objectId: 'obj1', expectedOldHash: 'expected' },
    ];
    const { errors } = applyReplay(base, ops);
    expect(errors.some(e => e.includes('hash mismatch'))).toBe(true);
  });

  it('reports error on add when object already exists', () => {
    const base = {
      objects: new Map([['obj1', { semanticHash: 'h' }]]),
    };
    const ops: ReplayOperation[] = [
      {
        operation: 'add', objectId: 'obj1', expectedOldHash: null,
        expectedAbsent: true,
        newObject: { semanticId: 'obj1', semanticHash: 'new' },
      },
    ];
    const { errors } = applyReplay(base, ops);
    expect(errors.some(e => e.includes('already exists'))).toBe(true);
  });
});

describe('verifyReplay', () => {
  it('verifies matching states', () => {
    const fp = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('fn', { bodyHash: 'h1' })],
        }),
      ],
    });
    const { verified, errors } = verifyReplay(fp, fp, []);
    expect(verified).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('fails verification when states diverge', () => {
    const base = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('fn', { bodyHash: 'h1' })],
        }),
      ],
    });
    const proposed = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('fn', { bodyHash: 'h2' })],
        }),
      ],
    });
    const { verified, errors } = verifyReplay(base, proposed, []);
    expect(verified).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });
});
