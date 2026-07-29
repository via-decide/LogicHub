import type { DeltaRecord, ImpactRecord, StalenessRecord } from './types.js';
import type { GraphMapResult } from '../graphmap/graphmap.js';
import type { GraphEdge } from '../graphmap/types.js';
import { sortByKeys, sortStrings } from '../util/deterministic.js';

export function analyzeImpact(
  deltas: DeltaRecord[],
  baseGraph: GraphMapResult | null,
  proposedGraph: GraphMapResult | null,
): ImpactRecord[] {
  const records: ImpactRecord[] = [];
  if (!baseGraph && !proposedGraph) return records;

  const graph = proposedGraph ?? baseGraph!;
  const adjacency = buildAdjacency(graph.edges);

  for (const delta of deltas) {
    const sourceNodes = delta.affectedNodeIds;
    for (const sourceNode of sourceNodes) {
      const visited = new Set<string>();
      const queue: Array<{ node: string; path: string[]; depth: number }> = [
        { node: sourceNode, path: [sourceNode], depth: 0 },
      ];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.depth > 3) continue;
        if (visited.has(current.node)) continue;
        visited.add(current.node);

        const neighbors = adjacency.get(current.node) ?? [];
        for (const neighbor of neighbors) {
          if (visited.has(neighbor.target)) continue;

          const sourceDomain = getDomainFromId(sourceNode);
          const targetDomain = getDomainFromId(neighbor.target);

          if (sourceDomain !== targetDomain || current.depth > 0) {
            records.push({
              sourceChangeId: delta.recordId,
              affectedNodeId: neighbor.target,
              affectedDomain: targetDomain,
              impactPath: [...current.path, neighbor.target],
              severity: inferSeverity(delta, neighbor.edge),
              reviewDomain: mapToReviewDomain(targetDomain),
            });
          }

          queue.push({
            node: neighbor.target,
            path: [...current.path, neighbor.target],
            depth: current.depth + 1,
          });
        }
      }
    }
  }

  return sortByKeys(records, [
    r => r.sourceChangeId,
    r => r.affectedNodeId,
  ]);
}

export function detectStaleEvidence(
  deltas: DeltaRecord[],
  graph: GraphMapResult | null,
): StalenessRecord[] {
  const records: StalenessRecord[] = [];
  if (!graph) return records;

  const changedNodes = new Set<string>();
  for (const delta of deltas) {
    for (const nodeId of delta.affectedNodeIds) {
      changedNodes.add(nodeId);
    }
  }

  for (const edge of graph.edges) {
    if (edge.type === 'VALIDATED_BY') {
      const isStale = changedNodes.has(edge.from);
      records.push({
        validationId: edge.to,
        targetNodeId: edge.from,
        reason: isStale
          ? `Target ${edge.from} was modified`
          : 'Target unchanged',
        isStale,
      });
    }
  }

  return sortByKeys(records, [r => r.validationId, r => r.targetNodeId]);
}

function buildAdjacency(edges: GraphEdge[]): Map<string, Array<{ target: string; edge: GraphEdge }>> {
  const adj = new Map<string, Array<{ target: string; edge: GraphEdge }>>();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push({ target: edge.to, edge });
    if (!adj.has(edge.to)) adj.set(edge.to, []);
    adj.get(edge.to)!.push({ target: edge.from, edge });
  }
  return adj;
}

function getDomainFromId(nodeId: string): string {
  if (nodeId.startsWith('software::') || nodeId.startsWith('entry::')) return 'software';
  if (nodeId.startsWith('firmware::')) return 'firmware';
  if (nodeId.startsWith('schematic::')) return 'schematic';
  if (nodeId.startsWith('pcb::')) return 'pcb';
  if (nodeId.startsWith('bom::')) return 'bom';
  if (nodeId.startsWith('constraint::')) return 'constraint';
  if (nodeId.startsWith('decision::')) return 'decision';
  if (nodeId.startsWith('validation::')) return 'validation';
  return 'unknown';
}

function inferSeverity(delta: DeltaRecord, edge: GraphEdge): 'info' | 'warning' | 'critical' {
  if (delta.deltaType === 'CONSTRAINT_CHANGED' || delta.deltaType === 'CONSTRAINT_REMOVED') return 'critical';
  if (delta.deltaType === 'SIGNATURE_CHANGED' || delta.deltaType === 'API_REMOVED') return 'warning';
  if (edge.resolution === 'direct' || edge.resolution === 'structural') return 'warning';
  return 'info';
}

function mapToReviewDomain(domain: string): string {
  const mapping: Record<string, string> = {
    software: 'software',
    firmware: 'firmware',
    schematic: 'electrical',
    pcb: 'pcb',
    bom: 'supply_chain',
    constraint: 'project_policy',
    decision: 'project_policy',
    validation: 'validation',
  };
  return mapping[domain] ?? domain;
}
