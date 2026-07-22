import { describe, it, expect } from 'vitest';
import { analyzeImpact, detectStaleEvidence } from '../../src/semdiff/impact-analyzer.js';
import type { DeltaRecord } from '../../src/semdiff/types.js';
import type { GraphMapResult } from '../../src/graphmap/graphmap.js';
import type { GraphEdge } from '../../src/graphmap/types.js';
import { sha256Hex } from '../../src/util/hash.js';
import { jcsCanonicalize } from '../../src/util/jcs.js';

function makeEdge(from: string, type: string, to: string, resolution = 'direct'): GraphEdge {
  return {
    edgeId: sha256Hex(jcsCanonicalize({ from, type, to, resolution })),
    from,
    type: type as GraphEdge['type'],
    to,
    resolution: resolution as GraphEdge['resolution'],
    confidenceBasis: 'exact_ast_reference',
    domain: 'software',
    evidence: { sourcePath: '', semanticLocator: '' },
  };
}

function makeDeltaRecord(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    schemaVersion: '0.1.0',
    deltaType: 'IMPLEMENTATION_CHANGED',
    domain: 'software',
    recordId: 'test-record',
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
    replayOperation: { operation: 'replace', objectId: 'x', expectedOldHash: null },
    reviewDomains: [],
    validationImplications: [],
    ...overrides,
  };
}

function makeGraph(edges: GraphEdge[]): GraphMapResult {
  return {
    edges,
    condensedDag: {
      originalModuleCount: 0,
      originalModuleEdgeCount: 0,
      sccCount: 0,
      sccMembership: {},
      condensedNodes: [],
      condensedEdges: [],
      topologicalOrder: [],
      topologicalSortCount: 0,
      acyclic: true,
    },
    manifest: {
      schemaVersion: '0.1.0',
      sourceFingerprintHash: '',
      sourceGitTreeId: '',
      toolchainProfileHash: '',
      nodeCountsByDomain: {},
      edgeCountsByType: {},
      edgeCountsByResolution: {},
      unresolvedRelationshipCount: 0,
      generationContentHash: '',
    },
    impactIndex: [],
  };
}

describe('analyzeImpact', () => {
  it('propagates impact across domains', () => {
    const delta = makeDeltaRecord({
      deltaType: 'IMPLEMENTATION_CHANGED',
      domain: 'software',
      affectedNodeIds: ['software::main.ts'],
    });

    const graph = makeGraph([
      makeEdge('software::main.ts', 'IMPORTS', 'software::sensor.ts'),
      makeEdge('software::sensor.ts', 'CALLS', 'firmware::gpio_read'),
    ]);

    const impacts = analyzeImpact([delta], graph, graph);
    expect(impacts.length).toBeGreaterThan(0);

    const crossDomain = impacts.filter(i => i.affectedDomain !== 'software');
    expect(crossDomain.length).toBeGreaterThan(0);
  });

  it('respects max depth of 3', () => {
    const delta = makeDeltaRecord({
      affectedNodeIds: ['software::a'],
    });

    const graph = makeGraph([
      makeEdge('software::a', 'IMPORTS', 'software::b'),
      makeEdge('software::b', 'IMPORTS', 'software::c'),
      makeEdge('software::c', 'IMPORTS', 'software::d'),
      makeEdge('software::d', 'IMPORTS', 'software::e'),
      makeEdge('software::e', 'IMPORTS', 'software::f'),
    ]);

    const impacts = analyzeImpact([delta], graph, graph);
    const impactedNodes = impacts.map(i => i.affectedNodeId);
    expect(impactedNodes).not.toContain('software::f');
  });

  it('returns empty for no deltas', () => {
    const graph = makeGraph([makeEdge('a', 'IMPORTS', 'b')]);
    const impacts = analyzeImpact([], graph, graph);
    expect(impacts).toHaveLength(0);
  });

  it('returns empty when no graph is available', () => {
    const delta = makeDeltaRecord({ affectedNodeIds: ['software::a'] });
    const impacts = analyzeImpact([delta], null, null);
    expect(impacts).toHaveLength(0);
  });

  it('infers critical severity for constraint changes', () => {
    const delta = makeDeltaRecord({
      deltaType: 'CONSTRAINT_CHANGED',
      domain: 'constraint',
      affectedNodeIds: ['constraint::voltage-max'],
    });

    const graph = makeGraph([
      makeEdge('constraint::voltage-max', 'CONSTRAINED_BY', 'schematic::U1'),
    ]);

    const impacts = analyzeImpact([delta], graph, graph);
    const criticals = impacts.filter(i => i.severity === 'critical');
    expect(criticals.length).toBeGreaterThan(0);
  });

  it('produces sorted output', () => {
    const delta = makeDeltaRecord({
      affectedNodeIds: ['software::z'],
    });

    const graph = makeGraph([
      makeEdge('software::z', 'IMPORTS', 'software::a'),
      makeEdge('software::z', 'IMPORTS', 'software::m'),
    ]);

    const impacts = analyzeImpact([delta], graph, graph);
    for (let i = 1; i < impacts.length; i++) {
      const prev = impacts[i - 1];
      const curr = impacts[i];
      const cmp = prev.sourceChangeId.localeCompare(curr.sourceChangeId) ||
                  prev.affectedNodeId.localeCompare(curr.affectedNodeId);
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });
});

describe('detectStaleEvidence', () => {
  it('marks evidence as stale when target changed', () => {
    const delta = makeDeltaRecord({
      affectedNodeIds: ['software::sensor.ts'],
    });

    const graph = makeGraph([
      makeEdge('software::sensor.ts', 'VALIDATED_BY', 'validation::test-suite-1'),
    ]);

    const records = detectStaleEvidence([delta], graph);
    expect(records.length).toBeGreaterThan(0);
    const staleRecord = records.find(r => r.isStale);
    expect(staleRecord).toBeDefined();
    expect(staleRecord!.validationId).toBe('validation::test-suite-1');
  });

  it('marks evidence as not stale when target not changed', () => {
    const delta = makeDeltaRecord({
      affectedNodeIds: ['software::other.ts'],
    });

    const graph = makeGraph([
      makeEdge('software::sensor.ts', 'VALIDATED_BY', 'validation::test-suite-1'),
    ]);

    const records = detectStaleEvidence([delta], graph);
    const record = records.find(r => r.validationId === 'validation::test-suite-1');
    expect(record).toBeDefined();
    expect(record!.isStale).toBe(false);
  });

  it('returns empty when no graph', () => {
    const delta = makeDeltaRecord({ affectedNodeIds: ['a'] });
    const records = detectStaleEvidence([delta], null);
    expect(records).toHaveLength(0);
  });
});
