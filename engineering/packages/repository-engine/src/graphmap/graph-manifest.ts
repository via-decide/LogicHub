import type { GraphEdge, GraphManifest, CondensedDag } from './types.js';
import type { FingerprintDescriptor } from '../types.js';
import { sha256Hex } from '../util/hash.js';
import { jcsCanonicalize } from '../util/jcs.js';
import { sortedRecord } from '../util/deterministic.js';

export function buildGraphManifest(
  edges: GraphEdge[],
  dag: CondensedDag,
  fingerprint: FingerprintDescriptor,
): GraphManifest {
  const nodeSet = new Set<string>();
  const nodesByDomain: Record<string, number> = {};
  const edgesByType: Record<string, number> = {};
  const edgesByResolution: Record<string, number> = {};
  let unresolvedCount = 0;

  for (const edge of edges) {
    nodeSet.add(edge.from);
    nodeSet.add(edge.to);

    const domain = getDomain(edge.from);
    nodesByDomain[domain] = (nodesByDomain[domain] ?? 0);

    edgesByType[edge.type] = (edgesByType[edge.type] ?? 0) + 1;
    edgesByResolution[edge.resolution] = (edgesByResolution[edge.resolution] ?? 0) + 1;

    if (edge.resolution === 'unresolved') unresolvedCount++;
  }

  for (const nodeId of nodeSet) {
    const domain = getDomain(nodeId);
    nodesByDomain[domain] = (nodesByDomain[domain] ?? 0) + 1;
  }

  const contentForHash = {
    edges: edges.map(e => e.edgeId).sort(),
    sccCount: dag.sccCount,
    nodeCount: nodeSet.size,
  };
  const generationContentHash = sha256Hex(jcsCanonicalize(contentForHash));

  return {
    schemaVersion: '0.1.0',
    sourceFingerprintHash: fingerprint.descriptorHash,
    sourceGitTreeId: fingerprint.identity.gitTreeId,
    toolchainProfileHash: fingerprint.identity.toolchainProfileHash,
    nodeCountsByDomain: sortedRecord(nodesByDomain),
    edgeCountsByType: sortedRecord(edgesByType),
    edgeCountsByResolution: sortedRecord(edgesByResolution),
    unresolvedRelationshipCount: unresolvedCount,
    generationContentHash,
  };
}

function getDomain(nodeId: string): string {
  if (nodeId.startsWith('software::') || nodeId.startsWith('entry::') || nodeId.startsWith('external::')) return 'software';
  if (nodeId.startsWith('firmware::')) return 'firmware';
  if (nodeId.startsWith('schematic::')) return 'electronics_schematic';
  if (nodeId.startsWith('pcb::')) return 'electronics_pcb';
  if (nodeId.startsWith('bom::')) return 'bom';
  if (nodeId.startsWith('constraint::')) return 'constraint';
  if (nodeId.startsWith('decision::')) return 'decision';
  if (nodeId.startsWith('validation::')) return 'validation';
  return 'unknown';
}
