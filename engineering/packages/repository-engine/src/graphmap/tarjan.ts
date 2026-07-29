import type { SccComponent, ComponentEdge, CondensedDag } from './types.js';

export function computeScc(
  nodes: string[],
  edges: Array<{ from: string; to: string }>,
): CondensedDag {
  const sortedNodes = [...nodes].sort();
  const adj = new Map<string, string[]>();
  for (const node of sortedNodes) adj.set(node, []);
  for (const edge of edges) {
    if (adj.has(edge.from)) {
      adj.get(edge.from)!.push(edge.to);
    }
  }
  for (const [, targets] of adj) targets.sort();

  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const components: SccComponent[] = [];
  let componentId = 0;

  function strongconnect(v: string): void {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const members: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        members.push(w);
      } while (w !== v);
      members.sort();
      components.push({ id: componentId++, members });
    }
  }

  for (const node of sortedNodes) {
    if (!indices.has(node)) {
      strongconnect(node);
    }
  }

  components.sort((a, b) => {
    const ka = a.members[0] ?? '';
    const kb = b.members[0] ?? '';
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  for (let i = 0; i < components.length; i++) components[i].id = i;

  const membership = new Map<string, number>();
  for (const comp of components) {
    for (const member of comp.members) {
      membership.set(member, comp.id);
    }
  }

  const condensedEdgeSet = new Set<string>();
  const condensedEdges: ComponentEdge[] = [];
  for (const edge of edges) {
    const fromComp = membership.get(edge.from);
    const toComp = membership.get(edge.to);
    if (fromComp !== undefined && toComp !== undefined && fromComp !== toComp) {
      const key = `${fromComp}->${toComp}`;
      if (!condensedEdgeSet.has(key)) {
        condensedEdgeSet.add(key);
        condensedEdges.push({ from: fromComp, to: toComp });
      }
    }
  }
  condensedEdges.sort((a, b) => a.from !== b.from ? a.from - b.from : a.to - b.to);

  const topo = topologicalSort(components.length, condensedEdges);

  const sccMembership: Record<string, number> = {};
  for (const [node, comp] of membership) sccMembership[node] = comp;

  return {
    originalModuleCount: nodes.length,
    originalModuleEdgeCount: edges.length,
    sccCount: components.length,
    sccMembership,
    condensedNodes: components,
    condensedEdges,
    topologicalOrder: topo,
    topologicalSortCount: topo.length,
    acyclic: components.every(c => c.members.length === 1) ||
      components.every(c => {
        if (c.members.length <= 1) return true;
        return false;
      }),
  };
}

function topologicalSort(nodeCount: number, edges: ComponentEdge[]): number[] {
  const inDegree = new Array(nodeCount).fill(0) as number[];
  const adj = new Map<number, number[]>();
  for (let i = 0; i < nodeCount; i++) adj.set(i, []);
  for (const edge of edges) {
    adj.get(edge.from)!.push(edge.to);
    inDegree[edge.to]++;
  }

  const queue: number[] = [];
  for (let i = 0; i < nodeCount; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }
  queue.sort((a, b) => a - b);

  const order: number[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    const neighbors = [...(adj.get(node) ?? [])].sort((a, b) => a - b);
    for (const next of neighbors) {
      inDegree[next]--;
      if (inDegree[next] === 0) {
        const insertIdx = queue.findIndex(q => q > next);
        if (insertIdx === -1) queue.push(next);
        else queue.splice(insertIdx, 0, next);
      }
    }
  }

  return order;
}
