import { describe, it, expect } from 'vitest';
import { generateDeltas } from '../../src/semdiff/delta-emitter.js';
import {
  makeFingerprint, makeSoftwareSurface, makeExport,
  makeSourceEntry, makeSymbolSummary, makeNetSummary,
  makeFootprintSummary, makeBomGroup, makeConstraint, makeDecision,
} from '../helpers.js';

describe('generateDeltas', () => {
  describe('software deltas', () => {
    it('detects API_ADDED when new exports appear', () => {
      const base = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', { exportedSymbols: [] })],
      });
      const proposed = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('newFn')],
        })],
      });
      const deltas = generateDeltas(base, proposed, null, null);
      const added = deltas.filter(d => d.deltaType === 'API_ADDED');
      expect(added.length).toBeGreaterThan(0);
    });

    it('detects API_REMOVED when exports disappear', () => {
      const base = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('oldFn')],
        })],
        sourceInventory: [makeSourceEntry('a.ts')],
      });
      const proposed = makeFingerprint({
        softwareSurface: [],
        sourceInventory: [],
      });
      const deltas = generateDeltas(base, proposed, null, null);
      const removed = deltas.filter(d => d.deltaType === 'API_REMOVED');
      expect(removed.length).toBe(1);
    });

    it('detects SIGNATURE_CHANGED when signature differs', () => {
      const base = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('fn', {
            normalizedSignature: 'function fn(a: number)',
            bodyHash: 'hash1',
          })],
        })],
      });
      const proposed = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('fn', {
            normalizedSignature: 'function fn(a: number, b: string)',
            bodyHash: 'hash2',
          })],
        })],
      });
      const deltas = generateDeltas(base, proposed, null, null);
      const sigChanged = deltas.filter(d => d.deltaType === 'SIGNATURE_CHANGED');
      expect(sigChanged.length).toBe(1);
    });

    it('detects IMPLEMENTATION_CHANGED when body hash differs', () => {
      const base = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('fn', { bodyHash: 'v1' })],
        })],
      });
      const proposed = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('fn', { bodyHash: 'v2' })],
        })],
      });
      const deltas = generateDeltas(base, proposed, null, null);
      const implChanged = deltas.filter(d => d.deltaType === 'IMPLEMENTATION_CHANGED');
      expect(implChanged.length).toBe(1);
    });

    it('detects DEPENDENCY_ADDED/REMOVED for imports', () => {
      const base = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          imports: [{ source: './old.js', specifiers: [], isRelative: true, isDynamic: false }],
        })],
      });
      const proposed = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          imports: [{ source: './new.js', specifiers: [], isRelative: true, isDynamic: false }],
        })],
      });
      const deltas = generateDeltas(base, proposed, null, null);
      const added = deltas.filter(d => d.deltaType === 'DEPENDENCY_ADDED');
      const removed = deltas.filter(d => d.deltaType === 'DEPENDENCY_REMOVED');
      expect(added.length).toBe(1);
      expect(removed.length).toBe(1);
    });
  });

  describe('schematic deltas', () => {
    const makeSchematicSurface = (symbols: ReturnType<typeof makeSymbolSummary>[], nets: ReturnType<typeof makeNetSummary>[]) => ({
      projectFiles: [],
      sheets: [],
      symbols,
      referenceDesignators: symbols.map(s => s.reference),
      values: symbols.map(s => s.value),
      footprints: symbols.map(s => s.footprint),
      mpns: [],
      totalPins: 0,
      nets,
      labels: [],
      hierarchicalLabels: [],
      powerSymbols: [],
      buses: [],
      noConnectMarkers: 0,
      sheetHierarchy: [],
      symbolSemanticHashes: [],
      netSemanticHashes: [],
      declaredExternalInterfaces: [],
    });

    it('detects SYMBOL_ADDED/REMOVED', () => {
      const base = makeFingerprint({
        schematicSurface: makeSchematicSurface(
          [makeSymbolSummary('C1')],
          [],
        ),
      });
      const proposed = makeFingerprint({
        schematicSurface: makeSchematicSurface(
          [makeSymbolSummary('C1'), makeSymbolSummary('R1')],
          [],
        ),
      });
      const deltas = generateDeltas(base, proposed, null, null);
      expect(deltas.some(d => d.deltaType === 'SYMBOL_ADDED')).toBe(true);
    });

    it('detects SYMBOL_VALUE_CHANGED', () => {
      const base = makeFingerprint({
        schematicSurface: makeSchematicSurface(
          [makeSymbolSummary('C1', { value: '100nF' })],
          [],
        ),
      });
      const proposed = makeFingerprint({
        schematicSurface: makeSchematicSurface(
          [makeSymbolSummary('C1', { value: '220nF' })],
          [],
        ),
      });
      const deltas = generateDeltas(base, proposed, null, null);
      expect(deltas.some(d => d.deltaType === 'SYMBOL_VALUE_CHANGED')).toBe(true);
    });

    it('detects NET_ADDED/REMOVED', () => {
      const base = makeFingerprint({
        schematicSurface: makeSchematicSurface([], [makeNetSummary('VCC')]),
      });
      const proposed = makeFingerprint({
        schematicSurface: makeSchematicSurface([], [makeNetSummary('VCC'), makeNetSummary('VBAT')]),
      });
      const deltas = generateDeltas(base, proposed, null, null);
      expect(deltas.some(d => d.deltaType === 'NET_ADDED')).toBe(true);
    });
  });

  describe('constraint deltas', () => {
    it('detects CONSTRAINT_ADDED/REMOVED/CHANGED', () => {
      const base = makeFingerprint({
        constraintSurface: {
          constraints: [
            makeConstraint('voltage-max', { semanticHash: 'hash_v1' }),
            makeConstraint('temp-limit'),
          ],
        },
      });
      const proposed = makeFingerprint({
        constraintSurface: {
          constraints: [
            makeConstraint('voltage-max', { semanticHash: 'hash_v2' }),
            makeConstraint('current-limit'),
          ],
        },
      });
      const deltas = generateDeltas(base, proposed, null, null);
      expect(deltas.some(d => d.deltaType === 'CONSTRAINT_CHANGED')).toBe(true);
      expect(deltas.some(d => d.deltaType === 'CONSTRAINT_REMOVED')).toBe(true);
      expect(deltas.some(d => d.deltaType === 'CONSTRAINT_ADDED')).toBe(true);
    });
  });

  describe('decision deltas', () => {
    it('detects DECISION_SUPERSEDED', () => {
      const base = makeFingerprint({
        decisionSurface: {
          decisions: [makeDecision('adr-001', { status: 'accepted' })],
        },
      });
      const proposed = makeFingerprint({
        decisionSurface: {
          decisions: [makeDecision('adr-001', { status: 'superseded' })],
        },
      });
      const deltas = generateDeltas(base, proposed, null, null);
      expect(deltas.some(d => d.deltaType === 'DECISION_SUPERSEDED')).toBe(true);
    });

    it('detects DECISION_ADDED', () => {
      const base = makeFingerprint({
        decisionSurface: { decisions: [] },
      });
      const proposed = makeFingerprint({
        decisionSurface: { decisions: [makeDecision('adr-002')] },
      });
      const deltas = generateDeltas(base, proposed, null, null);
      expect(deltas.some(d => d.deltaType === 'DECISION_ADDED')).toBe(true);
    });
  });

  describe('determinism', () => {
    it('produces identical output for identical input', () => {
      const base = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('fn')],
        })],
      });
      const proposed = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('fn', { bodyHash: 'changed' })],
        })],
      });
      const d1 = generateDeltas(base, proposed, null, null);
      const d2 = generateDeltas(base, proposed, null, null);
      expect(d1).toEqual(d2);
    });

    it('all delta recordIds are unique', () => {
      const base = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('x'), makeExport('y')],
        })],
        constraintSurface: { constraints: [makeConstraint('c1')] },
      });
      const proposed = makeFingerprint({
        softwareSurface: [makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('x', { bodyHash: 'new' }), makeExport('y')],
        })],
        constraintSurface: { constraints: [makeConstraint('c1', { semanticHash: 'new' })] },
      });
      const deltas = generateDeltas(base, proposed, null, null);
      const ids = deltas.map(d => d.recordId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
