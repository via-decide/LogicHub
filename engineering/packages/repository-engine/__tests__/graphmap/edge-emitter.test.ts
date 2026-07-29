import { describe, it, expect } from 'vitest';
import { buildGraphMap } from '../../src/graphmap/graphmap.js';
import {
  makeFingerprint, makeSoftwareSurface, makeExport,
  makeSymbolSummary, makeNetSummary, makeFootprintSummary,
  makeBomGroup, makeConstraint, makeDecision,
} from '../helpers.js';
import type { ImportRecord } from '../../src/types.js';

describe('edge generation', () => {
  it('generates EXPORTS edges for exported symbols', () => {
    const fingerprint = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('src/math.ts', {
          exportedSymbols: [makeExport('add'), makeExport('subtract')],
        }),
      ],
    });
    const result = buildGraphMap(fingerprint);
    const exportEdges = result.edges.filter(e => e.type === 'EXPORTS');
    expect(exportEdges.length).toBe(2);
  });

  it('generates IMPORTS edges for import statements', () => {
    const imp: ImportRecord = {
      source: './sensor.js',
      specifiers: ['read'],
      isRelative: true,
      isDynamic: false,
    };
    const fingerprint = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('src/main.ts', { imports: [imp] }),
        makeSoftwareSurface('src/sensor.ts', {
          exportedSymbols: [makeExport('read', {
            semanticId: 'software::src/sensor.ts::export::read',
          })],
        }),
      ],
    });
    const result = buildGraphMap(fingerprint);
    const importEdges = result.edges.filter(e => e.type === 'IMPORTS');
    expect(importEdges.length).toBeGreaterThanOrEqual(1);
  });

  it('generates CONTAINS edges for schematic symbols', () => {
    const fingerprint = makeFingerprint({
      schematicSurface: {
        projectFiles: ['project.kicad_pro'],
        sheets: [{ path: 'root.kicad_sch', name: 'root', semanticHash: 'h1' }],
        symbols: [
          makeSymbolSummary('C1'),
          makeSymbolSummary('R1', { value: '10k', footprint: 'Resistor_SMD:R_0402' }),
        ],
        referenceDesignators: ['C1', 'R1'],
        values: ['100nF', '10k'],
        footprints: ['Capacitor_SMD:C_0402', 'Resistor_SMD:R_0402'],
        mpns: [],
        totalPins: 4,
        nets: [makeNetSummary('VCC'), makeNetSummary('GND')],
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
    });
    const result = buildGraphMap(fingerprint);
    const containsEdges = result.edges.filter(e => e.type === 'CONTAINS');
    expect(containsEdges.length).toBeGreaterThan(0);
  });

  it('generates CONSTRAINED_BY edges for constraints', () => {
    const fingerprint = makeFingerprint({
      constraintSurface: {
        constraints: [
          makeConstraint('voltage-limit', {
            targetSemanticKeys: ['schematic::C1', 'schematic::R1'],
          }),
        ],
      },
    });
    const result = buildGraphMap(fingerprint);
    const constraintEdges = result.edges.filter(e => e.type === 'CONSTRAINED_BY');
    expect(constraintEdges.length).toBe(2);
  });

  it('generates DECIDED_BY edges for decisions', () => {
    const fingerprint = makeFingerprint({
      decisionSurface: {
        decisions: [
          makeDecision('adr-001', {
            affectedSemanticKeys: ['schematic::U1'],
          }),
        ],
      },
    });
    const result = buildGraphMap(fingerprint);
    const decisionEdges = result.edges.filter(e => e.type === 'DECIDED_BY');
    expect(decisionEdges.length).toBe(1);
  });

  it('produces deterministic edge IDs', () => {
    const fingerprint = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('foo')],
        }),
      ],
    });
    const r1 = buildGraphMap(fingerprint);
    const r2 = buildGraphMap(fingerprint);
    expect(r1.edges.map(e => e.edgeId)).toEqual(r2.edges.map(e => e.edgeId));
  });

  it('all edge IDs are unique', () => {
    const fingerprint = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('foo'), makeExport('bar')],
          imports: [{
            source: './b.js',
            specifiers: ['baz'],
            isRelative: true,
            isDynamic: false,
          }],
        }),
        makeSoftwareSurface('b.ts', {
          exportedSymbols: [makeExport('baz', {
            semanticId: 'software::b.ts::export::baz',
          })],
        }),
      ],
    });
    const result = buildGraphMap(fingerprint);
    const ids = result.edges.map(e => e.edgeId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('graphmap manifest', () => {
  it('counts nodes and edges correctly', () => {
    const fingerprint = makeFingerprint({
      softwareSurface: [
        makeSoftwareSurface('a.ts', {
          exportedSymbols: [makeExport('x')],
        }),
      ],
    });
    const result = buildGraphMap(fingerprint);
    const totalEdges = Object.values(result.manifest.edgeCountsByType).reduce((a, b) => a + b, 0);
    expect(totalEdges).toBe(result.edges.length);
    const totalNodes = Object.values(result.manifest.nodeCountsByDomain).reduce((a, b) => a + b, 0);
    expect(totalNodes).toBeGreaterThan(0);
  });
});
