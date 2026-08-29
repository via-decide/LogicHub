import { describe, it, expect } from 'vitest';
import { computeSemDiff } from '../../src/semdiff/semdiff.js';
import { buildGraphMap } from '../../src/graphmap/graphmap.js';
import {
  makeFingerprint, makeSoftwareSurface, makeExport,
  makeSourceEntry, makeConstraint, makeDecision,
  makeSymbolSummary, makeNetSummary,
} from '../helpers.js';

function makeSchematicSurface(
  symbols: ReturnType<typeof makeSymbolSummary>[],
  nets: ReturnType<typeof makeNetSummary>[],
) {
  return {
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
  };
}

describe('computeSemDiff (integration)', () => {
  it('produces complete result with all sections', () => {
    const base = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('src/main.ts', {
          exportedSymbols: [makeExport('init', { bodyHash: 'v1' })],
        }),
      ],
      constraintSurface: {
        constraints: [makeConstraint('c1', { semanticHash: 'ch1' })],
      },
    });

    const proposed = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('src/main.ts', {
          exportedSymbols: [
            makeExport('init', { bodyHash: 'v2' }),
            makeExport('shutdown'),
          ],
        }),
      ],
      constraintSurface: {
        constraints: [makeConstraint('c1', { semanticHash: 'ch2' })],
      },
    });

    const result = computeSemDiff({
      base: { fingerprint: base, graphMap: null },
      proposed: { fingerprint: proposed, graphMap: null },
    });

    expect(result.deltas.length).toBeGreaterThan(0);
    expect(result.replay).toBeDefined();
    expect(result.replay.schemaVersion).toBe('0.1.0');
    expect(result.replay.operations.length).toBeGreaterThan(0);
    expect(result.prSummary).toBeDefined();
    expect(result.prSummary.schemaVersion).toBe('0.1.0');
  });

  it('includes graph-based impacts when graphs provided', () => {
    const base = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('src/sensor.ts', {
          exportedSymbols: [makeExport('readSensor', { bodyHash: 'v1' })],
        }),
      ],
      constraintSurface: {
        constraints: [
          makeConstraint('voltage-limit', {
            targetSemanticKeys: ['software::test.ts::export::readSensor'],
          }),
        ],
      },
    });

    const proposed = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('src/sensor.ts', {
          exportedSymbols: [makeExport('readSensor', { bodyHash: 'v2' })],
        }),
      ],
      constraintSurface: {
        constraints: [
          makeConstraint('voltage-limit', {
            targetSemanticKeys: ['software::test.ts::export::readSensor'],
          }),
        ],
      },
    });

    const baseGraph = buildGraphMap(base);
    const proposedGraph = buildGraphMap(proposed);

    const result = computeSemDiff({
      base: { fingerprint: base, graphMap: baseGraph },
      proposed: { fingerprint: proposed, graphMap: proposedGraph },
    });

    expect(result.deltas.length).toBeGreaterThan(0);
  });

  it('detects multi-domain changes', () => {
    const base = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('src/main.ts', {
          exportedSymbols: [makeExport('main', { bodyHash: 'v1' })],
        }),
      ],
      schematicSurface: makeSchematicSurface(
        [makeSymbolSummary('C1', { value: '100nF' })],
        [makeNetSummary('VCC')],
      ),
      decisionSurface: {
        decisions: [makeDecision('adr-001', { status: 'accepted' })],
      },
    });

    const proposed = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('src/main.ts', {
          exportedSymbols: [makeExport('main', { bodyHash: 'v2' })],
        }),
      ],
      schematicSurface: makeSchematicSurface(
        [makeSymbolSummary('C1', { value: '220nF' })],
        [makeNetSummary('VCC'), makeNetSummary('VBAT')],
      ),
      decisionSurface: {
        decisions: [makeDecision('adr-001', { status: 'superseded' })],
      },
    });

    const result = computeSemDiff({
      base: { fingerprint: base, graphMap: null },
      proposed: { fingerprint: proposed, graphMap: null },
    });

    const domains = new Set(result.deltas.map(d => d.domain));
    expect(domains.has('software')).toBe(true);
    expect(domains.has('schematic')).toBe(true);
    expect(domains.has('decision')).toBe(true);

    expect(result.prSummary.reviewDomainsRequired.length).toBeGreaterThan(0);
  });

  it('PR summary identifies breaking changes as merge blockers', () => {
    const base = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('api.ts', {
          exportedSymbols: [makeExport('publicApi')],
        }),
      ],
      sourceInventory: [makeSourceEntry('api.ts')],
    });

    const proposed = makeFingerprint({
      softwareSurface: [],
      sourceInventory: [],
    });

    const result = computeSemDiff({
      base: { fingerprint: base, graphMap: null },
      proposed: { fingerprint: proposed, graphMap: null },
    });

    expect(result.prSummary.breakingSoftwareChanges.length).toBeGreaterThan(0);
    expect(result.prSummary.deterministicMergeBlockers.length).toBeGreaterThan(0);
  });

  it('produces deterministic output', () => {
    const base = makeFingerprint({
      softwareSurface: [makeSoftwareSurface('a.ts', {
        exportedSymbols: [makeExport('fn', { bodyHash: 'h1' })],
      })],
    });
    const proposed = makeFingerprint({
      softwareSurface: [makeSoftwareSurface('a.ts', {
        exportedSymbols: [makeExport('fn', { bodyHash: 'h2' })],
      })],
    });

    const r1 = computeSemDiff({
      base: { fingerprint: base, graphMap: null },
      proposed: { fingerprint: proposed, graphMap: null },
    });
    const r2 = computeSemDiff({
      base: { fingerprint: base, graphMap: null },
      proposed: { fingerprint: proposed, graphMap: null },
    });

    expect(r1.deltas).toEqual(r2.deltas);
    expect(r1.replay.replayHash).toEqual(r2.replay.replayHash);
    expect(r1.prSummary).toEqual(r2.prSummary);
  });

  it('replay verifies for a PCB footprint addition alongside a same-object multi-facet schematic change', () => {
    const base = makeFingerprint({
      schematicSurface: null,
      pcbSurface: {
        boardIdentity: 'board_hash',
        footprints: [{ reference: 'U1', footprint: 'splp:SOT-223', layer: 'F.Cu', padCount: 3, semanticId: 'pcb::U1' }],
        pads: [], nets: [], layers: [], boardOutline: null, trackCount: 0, viaCount: 0, zoneCount: 0,
        differentialPairs: [], designRuleClasses: [], clearances: {}, stackUpMetadata: null,
        testPoints: [], mountingHoles: [], pcbSemanticHash: 'pcb_hash_base',
      },
    });
    const proposed = makeFingerprint({
      schematicSurface: null,
      pcbSurface: {
        boardIdentity: 'board_hash',
        footprints: [
          { reference: 'U1', footprint: 'splp:SOT-23-5', layer: 'F.Cu', padCount: 5, semanticId: 'pcb::U1' },
          { reference: 'D2', footprint: 'splp:D_SMA', layer: 'F.Cu', padCount: 2, semanticId: 'pcb::D2' },
        ],
        pads: [], nets: [], layers: [], boardOutline: null, trackCount: 0, viaCount: 0, zoneCount: 0,
        differentialPairs: [], designRuleClasses: [], clearances: {}, stackUpMetadata: null,
        testPoints: [], mountingHoles: [], pcbSemanticHash: 'pcb_hash_proposed',
      },
    });

    const result = computeSemDiff({
      base: { fingerprint: base, graphMap: null },
      proposed: { fingerprint: proposed, graphMap: null },
    });

    expect(result.deltas.some(d => d.deltaType === 'FOOTPRINT_CHANGED' && d.oldSemanticId === 'pcb::U1')).toBe(true);
    expect(result.deltas.some(d => d.deltaType === 'FOOTPRINT_ADDED' && d.newSemanticId === 'pcb::D2')).toBe(true);
    expect(result.replayErrors).toEqual([]);
    expect(result.replayVerified).toBe(true);
  });
});
