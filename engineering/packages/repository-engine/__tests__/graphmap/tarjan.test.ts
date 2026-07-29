import { describe, it, expect } from 'vitest';
import { computeScc } from '../../src/graphmap/tarjan.js';

describe('computeScc (Tarjan)', () => {
  it('handles empty graph', () => {
    const result = computeScc([], []);
    expect(result.sccCount).toBe(0);
    expect(result.acyclic).toBe(true);
    expect(result.condensedNodes).toHaveLength(0);
    expect(result.condensedEdges).toHaveLength(0);
  });

  it('handles single node', () => {
    const result = computeScc(['A'], []);
    expect(result.sccCount).toBe(1);
    expect(result.acyclic).toBe(true);
    expect(result.condensedNodes).toHaveLength(1);
    expect(result.condensedNodes[0].members).toEqual(['A']);
  });

  it('handles simple DAG (no cycles)', () => {
    const nodes = ['A', 'B', 'C'];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ];
    const result = computeScc(nodes, edges);
    expect(result.sccCount).toBe(3);
    expect(result.acyclic).toBe(true);
    expect(result.topologicalOrder).toHaveLength(3);
  });

  it('detects a simple cycle', () => {
    const nodes = ['A', 'B', 'C'];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' },
    ];
    const result = computeScc(nodes, edges);
    expect(result.sccCount).toBe(1);
    expect(result.acyclic).toBe(false);
    expect(result.condensedNodes[0].members).toHaveLength(3);
    expect(result.condensedNodes[0].members.sort()).toEqual(['A', 'B', 'C']);
  });

  it('handles mixed: cycle + dangling', () => {
    const nodes = ['A', 'B', 'C', 'D'];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'D' },
    ];
    const result = computeScc(nodes, edges);
    expect(result.sccCount).toBe(3);
    expect(result.acyclic).toBe(false);

    const cycleComponent = result.condensedNodes.find(c => c.members.length > 1)!;
    expect(cycleComponent.members.sort()).toEqual(['A', 'B']);
  });

  it('produces deterministic output', () => {
    const nodes = ['C', 'A', 'B'];
    const edges = [
      { from: 'C', to: 'A' },
      { from: 'A', to: 'B' },
    ];
    const r1 = computeScc(nodes, edges);
    const r2 = computeScc(nodes, edges);
    expect(r1.condensedNodes).toEqual(r2.condensedNodes);
    expect(r1.condensedEdges).toEqual(r2.condensedEdges);
    expect(r1.topologicalOrder).toEqual(r2.topologicalOrder);
  });

  it('handles disconnected graph', () => {
    const nodes = ['A', 'B', 'C', 'D'];
    const edges = [
      { from: 'A', to: 'B' },
    ];
    const result = computeScc(nodes, edges);
    expect(result.sccCount).toBe(4);
    expect(result.acyclic).toBe(true);
  });

  it('handles self-loop', () => {
    const nodes = ['A', 'B'];
    const edges = [
      { from: 'A', to: 'A' },
      { from: 'A', to: 'B' },
    ];
    const result = computeScc(nodes, edges);
    // Tarjan's standard: self-loop node stays in size-1 SCC
    // The implementation treats all size-1 SCCs as acyclic
    expect(result.sccCount).toBe(2);
    const aComponent = result.condensedNodes.find(c => c.members.includes('A'));
    expect(aComponent).toBeDefined();
    expect(aComponent!.members).toEqual(['A']);
  });

  it('produces valid topological ordering for condensed DAG', () => {
    const nodes = ['A', 'B', 'C', 'D', 'E'];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'B' },
      { from: 'C', to: 'D' },
      { from: 'D', to: 'E' },
    ];
    const result = computeScc(nodes, edges);

    const orderIndex = new Map<number, number>();
    for (let i = 0; i < result.topologicalOrder.length; i++) {
      orderIndex.set(result.topologicalOrder[i], i);
    }

    for (const edge of result.condensedEdges) {
      const fromIdx = orderIndex.get(edge.from)!;
      const toIdx = orderIndex.get(edge.to)!;
      expect(fromIdx).toBeLessThan(toIdx);
    }
  });

  it('preserves sccMembership mapping', () => {
    const nodes = ['X', 'Y', 'Z'];
    const edges = [
      { from: 'X', to: 'Y' },
      { from: 'Y', to: 'Z' },
      { from: 'Z', to: 'X' },
    ];
    const result = computeScc(nodes, edges);
    expect(result.sccMembership['X']).toBeDefined();
    expect(result.sccMembership['X']).toBe(result.sccMembership['Y']);
    expect(result.sccMembership['Y']).toBe(result.sccMembership['Z']);
  });
});
