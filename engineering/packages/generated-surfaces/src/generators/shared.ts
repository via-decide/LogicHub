import type { LogicNode, ProductGraph } from '@logichub-engineering/product-graph';
import type { EpistemicState } from '../schemas/surface.schema.js';

/** Nodes in stable id order, so a surface never depends on insertion order. */
export function sortedNodes(graph: ProductGraph): LogicNode[] {
  return [...graph.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function numberMetric(node: LogicNode, key: string): number | undefined {
  const raw = node.derivedMetrics[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

export function stringMetric(node: LogicNode, key: string): string | undefined {
  const raw = node.derivedMetrics[key];
  return typeof raw === 'string' ? raw : undefined;
}

const KNOWN_STATES: readonly EpistemicState[] = [
  'ESTIMATED', 'CALCULATED', 'SIMULATED', 'MEASURED', 'VERIFIED',
];

/**
 * The epistemic state a node reports, or UNKNOWN when it reports none. A
 * surface never upgrades a value's standing on the node's behalf.
 */
export function epistemicOf(node: LogicNode): EpistemicState {
  const raw = stringMetric(node, 'epistemicState');
  return raw !== undefined && (KNOWN_STATES as readonly string[]).includes(raw)
    ? raw as EpistemicState
    : 'UNKNOWN';
}
