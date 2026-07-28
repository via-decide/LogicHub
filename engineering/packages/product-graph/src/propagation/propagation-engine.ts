import type { LogicNode, ProductGraph } from '../schemas/product-graph.schema.js';
import { nodeRegistry } from '../nodes/node-registry.js';
import {
  round,
  readNumber,
  type ConstraintSeverity,
  type MetricValue,
  type NodeContext,
} from '../nodes/node-plugin.js';

export interface PropagationViolation {
  nodeId: string;
  nodeType: string;
  code: string;
  severity: ConstraintSeverity;
  message: string;
}

export interface PropagationResult {
  /** New graph with every derived metric, capability and constraint refreshed. */
  graph: ProductGraph;
  /** All violations, ordered deterministically by node id then code. */
  violations: PropagationViolation[];
  /** Evaluation order actually used. */
  order: string[];
  /** Node ids that participate in a dependency cycle, if any. */
  cycleNodeIds: string[];
}

/**
 * Recalculate the whole graph.
 *
 * Two passes run over the topological order. The first resolves upstream
 * values; the second lets a node see what its downstream neighbours ended up
 * demanding (a battery cannot know its runtime until the loads it feeds have
 * published theirs). Two fixed passes terminate and stay deterministic — the
 * same graph in always produces the same graph out, including the ordering of
 * every violation.
 *
 * `updatedAt` is deliberately left untouched: recalculation is not an edit.
 */
export function propagate(graph: ProductGraph): PropagationResult {
  const { order, cycleNodeIds } = topologicalOrder(graph);

  let working = graph;
  let violations: PropagationViolation[] = [];

  for (let pass = 0; pass < 2; pass += 1) {
    const outcome = runPass(working, order);
    working = outcome.graph;
    violations = outcome.violations;
  }

  if (cycleNodeIds.length > 0) {
    for (const nodeId of cycleNodeIds) {
      violations.push({
        nodeId,
        nodeType: working.nodes.find(n => n.id === nodeId)?.type ?? 'unknown',
        code: 'graph.dependency-cycle',
        severity: 'error',
        message: 'Node participates in a dependency cycle; its values are not resolved.',
      });
    }
  }

  violations.push(...checkPowerBudget(working));

  violations.sort(compareViolations);

  return { graph: working, violations, order, cycleNodeIds };
}

interface PassOutcome {
  graph: ProductGraph;
  violations: PropagationViolation[];
}

function runPass(graph: ProductGraph, order: string[]): PassOutcome {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const violations: PropagationViolation[] = [];

  for (const nodeId of order) {
    const node = byId.get(nodeId);
    if (!node) continue;

    const plugin = nodeRegistry.get(node.type);
    if (!plugin) {
      violations.push({
        nodeId,
        nodeType: node.type,
        code: 'graph.unknown-node-type',
        severity: 'error',
        message: `No plugin is registered for node type "${node.type}".`,
      });
      continue;
    }

    const ctx: NodeContext = {
      nodeId,
      // Nodes read the partially-updated graph so upstream results are visible.
      graph: { ...graph, nodes: [...byId.values()] },
      userMode: graph.userMode,
      upstream: mergeUpstreamCapabilities(graph, byId, nodeId),
      upstreamNodes: directNeighbours(graph, byId, nodeId, 'in'),
      downstreamNodes: directNeighbours(graph, byId, nodeId, 'out'),
      transitiveDownstreamNodes: transitiveDownstream(graph, byId, nodeId),
    };

    let params: unknown;
    try {
      params = plugin.parseParameters(node.parameters);
    } catch (error) {
      violations.push({
        nodeId,
        nodeType: node.type,
        code: 'node.invalid-parameters',
        severity: 'error',
        message: error instanceof Error ? error.message : 'Parameters failed validation.',
      });
      // Values stay empty rather than stale: an unreadable node reports nothing.
      byId.set(nodeId, {
        ...node,
        derivedMetrics: {},
        capabilities: {},
        requirements: {},
        constraints: ['node.invalid-parameters'],
      });
      continue;
    }

    const typedParams = params as never;
    const derivedMetrics: Record<string, MetricValue> = plugin.deriveMetrics(typedParams, ctx);
    const capabilities = plugin.exposeCapabilities(typedParams, derivedMetrics);
    const requirements = plugin.exposeRequirements(typedParams, derivedMetrics);
    const constraintResults = plugin.validate(typedParams, ctx);

    for (const constraint of constraintResults) {
      violations.push({
        nodeId,
        nodeType: node.type,
        code: constraint.code,
        severity: constraint.severity,
        message: constraint.message,
      });
    }

    byId.set(nodeId, {
      ...node,
      derivedMetrics,
      capabilities,
      requirements,
      constraints: constraintResults.map(c => c.code).sort(),
    });
  }

  // Preserve the caller's node ordering so the graph shape never shifts.
  const nodes = graph.nodes.map(n => byId.get(n.id) ?? n);
  return { graph: { ...graph, nodes }, violations };
}

/**
 * Kahn's algorithm with an id-sorted ready set, so ties resolve identically on
 * every run. Nodes left over after the queue drains are in a cycle.
 */
export function topologicalOrder(graph: ProductGraph): { order: string[]; cycleNodeIds: string[] } {
  const ids = graph.nodes.map(n => n.id).sort();
  const indegree = new Map<string, number>(ids.map(id => [id, 0]));
  const outgoing = new Map<string, string[]>(ids.map(id => [id, []]));

  for (const conn of [...graph.connections].sort(compareConnections)) {
    if (!indegree.has(conn.from) || !indegree.has(conn.to)) continue;
    if (conn.from === conn.to) continue;
    outgoing.get(conn.from)!.push(conn.to);
    indegree.set(conn.to, indegree.get(conn.to)! + 1);
  }

  const ready = ids.filter(id => indegree.get(id) === 0).sort();
  const order: string[] = [];

  while (ready.length > 0) {
    const next = ready.shift()!;
    order.push(next);
    for (const target of [...outgoing.get(next)!].sort()) {
      const remaining = indegree.get(target)! - 1;
      indegree.set(target, remaining);
      if (remaining === 0) {
        ready.push(target);
        ready.sort();
      }
    }
  }

  const cycleNodeIds = ids.filter(id => !order.includes(id));
  // Cycle members still get evaluated, just without a guaranteed ordering.
  return { order: [...order, ...cycleNodeIds], cycleNodeIds };
}

function mergeUpstreamCapabilities(
  graph: ProductGraph,
  byId: Map<string, LogicNode>,
  nodeId: string,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const upstream of directNeighbours(graph, byId, nodeId, 'in')) {
    for (const key of Object.keys(upstream.capabilities).sort()) {
      merged[key] = upstream.capabilities[key];
    }
  }
  return merged;
}

function directNeighbours(
  graph: ProductGraph,
  byId: Map<string, LogicNode>,
  nodeId: string,
  direction: 'in' | 'out',
): LogicNode[] {
  const neighbourIds = new Set<string>();
  for (const conn of graph.connections) {
    if (direction === 'in' && conn.to === nodeId) neighbourIds.add(conn.from);
    if (direction === 'out' && conn.from === nodeId) neighbourIds.add(conn.to);
  }
  return [...neighbourIds]
    .sort()
    .map(id => byId.get(id))
    .filter((n): n is LogicNode => n !== undefined);
}

function transitiveDownstream(
  graph: ProductGraph,
  byId: Map<string, LogicNode>,
  nodeId: string,
): LogicNode[] {
  const seen = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const conn of graph.connections) {
      if (conn.from === current && !seen.has(conn.to) && conn.to !== nodeId) {
        seen.add(conn.to);
        queue.push(conn.to);
      }
    }
  }
  return [...seen]
    .sort()
    .map(id => byId.get(id))
    .filter((n): n is LogicNode => n !== undefined);
}

/**
 * Graph-level check: a pack must be able to supply the peak current its loads
 * can draw. When either side is unknown the check reports that it could not be
 * evaluated rather than passing by default.
 */
function checkPowerBudget(graph: ProductGraph): PropagationViolation[] {
  const violations: PropagationViolation[] = [];
  const byId = new Map(graph.nodes.map(n => [n.id, n]));

  for (const battery of graph.nodes.filter(n => n.type === 'battery')) {
    const supplyA = readNumber(battery.capabilities as Record<string, unknown>, 'power.maxCurrentA');
    const loads = transitiveDownstream(graph, byId, battery.id);
    if (loads.length === 0) continue;

    let demandA: number | undefined;
    let unknownLoads = 0;
    for (const load of loads) {
      const currentA = readNumber(load.requirements as Record<string, unknown>, 'power.currentA');
      if (currentA === undefined) {
        unknownLoads += 1;
      } else {
        demandA = (demandA ?? 0) + currentA;
      }
    }

    if (supplyA === undefined || demandA === undefined) {
      violations.push({
        nodeId: battery.id,
        nodeType: battery.type,
        code: 'power.budget-unknown',
        severity: 'warning',
        message: 'Power budget could not be evaluated; supply or demand is unknown.',
      });
      continue;
    }

    if (demandA > supplyA) {
      violations.push({
        nodeId: battery.id,
        nodeType: battery.type,
        code: 'power.budget-exceeded',
        severity: 'error',
        message:
          `Connected loads can draw ${round(demandA, 2)} A but the pack supplies ` +
          `${round(supplyA, 2)} A.`,
      });
    }

    if (unknownLoads > 0) {
      violations.push({
        nodeId: battery.id,
        nodeType: battery.type,
        code: 'power.budget-partial',
        severity: 'warning',
        message: `${unknownLoads} connected node(s) publish no current draw; the budget is incomplete.`,
      });
    }
  }

  return violations;
}

function compareViolations(a: PropagationViolation, b: PropagationViolation): number {
  if (a.nodeId !== b.nodeId) return a.nodeId < b.nodeId ? -1 : 1;
  if (a.code !== b.code) return a.code < b.code ? -1 : 1;
  return 0;
}

function compareConnections(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
