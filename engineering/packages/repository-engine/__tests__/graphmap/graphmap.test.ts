import { describe, it, expect } from 'vitest';
import { buildGraphMap, edgesToNdjson } from '../../src/graphmap/graphmap.js';
import {
  makeFingerprint, makeSoftwareSurface, makeExport,
  makeSymbolSummary, makeNetSummary, makeFootprintSummary,
  makeBomGroup, makeConstraint, makeDecision,
} from '../helpers.js';
import type { ImportRecord } from '../../src/types.js';

describe('buildGraphMap (integration)', () => {
  it('builds complete graph from multi-domain fingerprint', () => {
    const imp: ImportRecord = {
      source: './sensor.js',
      specifiers: ['readSensor'],
      isRelative: true,
      isDynamic: false,
    };

    const fingerprint = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('src/main.ts', {
          exportedSymbols: [makeExport('init')],
          imports: [imp],
        }),
        makeSoftwareSurface('src/sensor.ts', {
          exportedSymbols: [makeExport('readSensor', {
            semanticId: 'software::src/sensor.ts::export::readSensor',
          })],
        }),
      ],
      schematicSurface: {
        projectFiles: ['proj.kicad_pro'],
        sheets: [{ path: 'root.kicad_sch', name: 'root', semanticHash: 'h' }],
        symbols: [makeSymbolSummary('C1'), makeSymbolSummary('R1')],
        referenceDesignators: ['C1', 'R1'],
        values: ['100nF', '10k'],
        footprints: ['Cap:C_0402', 'Res:R_0402'],
        mpns: [],
        totalPins: 4,
        nets: [makeNetSummary('VCC')],
        labels: [],
        hierarchicalLabels: [],
        powerSymbols: [],
        buses: [],
        noConnectMarkers: 0,
        sheetHierarchy: ['root'],
        symbolSemanticHashes: [],
        netSemanticHashes: [],
        declaredExternalInterfaces: [],
      },
      constraintSurface: {
        constraints: [
          makeConstraint('voltage', { targetSemanticKeys: ['schematic::C1'] }),
        ],
      },
    });

    const result = buildGraphMap(fingerprint);

    expect(result.edges.length).toBeGreaterThan(0);
    const totalEdges = Object.values(result.manifest.edgeCountsByType).reduce((a, b) => a + b, 0);
    expect(totalEdges).toBe(result.edges.length);
    const totalNodes = Object.values(result.manifest.nodeCountsByDomain).reduce((a, b) => a + b, 0);
    expect(totalNodes).toBeGreaterThan(0);
    expect(result.condensedDag).toBeDefined();
    expect(result.impactIndex.length).toBeGreaterThan(0);

    const edgeTypes = new Set(result.edges.map(e => e.type));
    expect(edgeTypes.has('EXPORTS')).toBe(true);
  });

  it('produces deterministic results', () => {
    const fingerprint = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('x'), makeExport('y')],
        }),
      ],
    });

    const r1 = buildGraphMap(fingerprint);
    const r2 = buildGraphMap(fingerprint);

    expect(r1.edges).toEqual(r2.edges);
    expect(r1.manifest).toEqual(r2.manifest);
  });

  it('handles empty fingerprint', () => {
    const fingerprint = makeFingerprint();
    const result = buildGraphMap(fingerprint);
    expect(result.edges).toHaveLength(0);
    const totalNodes = Object.values(result.manifest.nodeCountsByDomain).reduce((a, b) => a + b, 0);
    expect(totalNodes).toBe(0);
    const totalEdges = Object.values(result.manifest.edgeCountsByType).reduce((a, b) => a + b, 0);
    expect(totalEdges).toBe(0);
    expect(result.condensedDag.acyclic).toBe(true);
  });
});

describe('edgesToNdjson', () => {
  it('produces valid NDJSON', () => {
    const fingerprint = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('fn')],
        }),
      ],
    });

    const result = buildGraphMap(fingerprint);
    const ndjson = edgesToNdjson(result.edges);
    const lines = ndjson.trim().split('\n');

    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('handles empty edge list', () => {
    const ndjson = edgesToNdjson([]);
    expect(ndjson).toBe('\n');
  });
});
