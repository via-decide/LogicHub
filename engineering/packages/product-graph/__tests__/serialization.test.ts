import { describe, it, expect } from 'vitest';
import { serializeGraph, deserializeGraph } from '../src/graph/serialization.js';
import { propagate } from '../src/propagation/propagation-engine.js';
import { createEmptyGraph } from '../src/graph/graph-ops.js';
import { motionStarterGraph } from './helpers.js';

describe('Gate 1 — serialization', () => {
  it('round-trips an empty graph', () => {
    const graph = createEmptyGraph();
    expect(deserializeGraph(serializeGraph(graph))).toEqual(graph);
  });

  it('round-trips the Motion Starter slice after propagation', () => {
    const { graph } = propagate(motionStarterGraph());
    const restored = deserializeGraph(serializeGraph(graph));
    expect(restored).toEqual(graph);
  });

  it('carries the schema version through the round trip', () => {
    const graph = motionStarterGraph();
    const restored = deserializeGraph(serializeGraph(graph));
    expect(restored.schemaVersion).toBe(graph.schemaVersion);
  });

  it('rejects text that is not JSON', () => {
    expect(() => deserializeGraph('{not json')).toThrow(/Invalid JSON/);
  });

  it('rejects JSON that does not satisfy the graph schema', () => {
    expect(() => deserializeGraph('{"id":"g1"}')).toThrow(/Schema validation failed/);
  });

  it('rejects a node that is missing required fields', () => {
    const broken = JSON.stringify({
      ...createEmptyGraph(),
      nodes: [{ id: 'n1', type: 'battery' }],
    });
    expect(() => deserializeGraph(broken)).toThrow(/Schema validation failed/);
  });

  it('serializes the same graph to identical text every time', () => {
    const { graph } = propagate(motionStarterGraph());
    const first = serializeGraph(graph);
    for (let i = 0; i < 5; i += 1) {
      expect(serializeGraph(graph)).toBe(first);
    }
  });
});
