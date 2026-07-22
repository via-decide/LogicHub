import type { FingerprintDescriptor } from '../types.js';
import type { GraphEdge, CondensedDag, GraphManifest, ImpactIndexEntry } from './types.js';
import { generateSoftwareEdges } from './software-edges.js';
import { generateElectronicsEdges } from './electronics-edges.js';
import { generateCrossDomainEdges } from './cross-domain-edges.js';
import { computeScc } from './tarjan.js';
import { buildGraphManifest } from './graph-manifest.js';
import { sortByKeys } from '../util/deterministic.js';
import { jcsCanonicalize } from '../util/jcs.js';

export interface GraphMapResult {
  edges: GraphEdge[];
  condensedDag: CondensedDag;
  manifest: GraphManifest;
  impactIndex: ImpactIndexEntry[];
}

export function buildGraphMap(fingerprint: FingerprintDescriptor): GraphMapResult {
  const allEdges: GraphEdge[] = [];

  const softwareEdges = generateSoftwareEdges(fingerprint.softwareSurface);
  allEdges.push(...softwareEdges);

  const electronicsEdges = generateElectronicsEdges(
    fingerprint.schematicSurface,
    fingerprint.pcbSurface,
    fingerprint.bomSurface,
  );
  allEdges.push(...electronicsEdges);

  const crossDomainEdges = generateCrossDomainEdges(
    fingerprint.constraintSurface,
    fingerprint.decisionSurface,
  );
  allEdges.push(...crossDomainEdges);

  const sortedEdges = sortByKeys(allEdges, [
    e => e.from,
    e => e.type,
    e => e.to,
    e => e.resolution,
    e => e.edgeId,
  ]);

  const moduleNodes = new Set<string>();
  const moduleEdges: Array<{ from: string; to: string }> = [];
  for (const edge of softwareEdges) {
    if (edge.type === 'IMPORTS' || edge.type === 'CALLS') {
      moduleNodes.add(edge.from);
      moduleNodes.add(edge.to);
      moduleEdges.push({ from: edge.from, to: edge.to });
    }
  }

  const condensedDag = computeScc([...moduleNodes], moduleEdges);
  const manifest = buildGraphManifest(sortedEdges, condensedDag, fingerprint);
  const impactIndex = buildImpactIndex(sortedEdges);

  return {
    edges: sortedEdges,
    condensedDag,
    manifest,
    impactIndex,
  };
}

function buildImpactIndex(edges: GraphEdge[]): ImpactIndexEntry[] {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  const domains = new Map<string, Set<string>>();
  const constraints = new Map<string, string[]>();
  const validations = new Map<string, string[]>();
  const allNodes = new Set<string>();

  for (const edge of edges) {
    allNodes.add(edge.from);
    allNodes.add(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);

    if (!domains.has(edge.from)) domains.set(edge.from, new Set());
    if (!domains.has(edge.to)) domains.set(edge.to, new Set());
    domains.get(edge.from)!.add(edge.domain);
    domains.get(edge.to)!.add(edge.domain);

    if (edge.type === 'CONSTRAINED_BY') {
      if (!constraints.has(edge.from)) constraints.set(edge.from, []);
      constraints.get(edge.from)!.push(edge.to);
    }
    if (edge.type === 'VALIDATED_BY') {
      if (!validations.has(edge.from)) validations.set(edge.from, []);
      validations.get(edge.from)!.push(edge.to);
    }
  }

  const entries: ImpactIndexEntry[] = [];
  for (const nodeId of allNodes) {
    const affectedDomains = [...(domains.get(nodeId) ?? [])].sort();
    const isPublic = nodeId.includes('::export::') || nodeId.includes('::interface::');

    entries.push({
      nodeId,
      directIncoming: incoming.get(nodeId) ?? 0,
      directOutgoing: outgoing.get(nodeId) ?? 0,
      affectedDomains,
      blockingConstraints: (constraints.get(nodeId) ?? []).sort(),
      validationSpecs: (validations.get(nodeId) ?? []).sort(),
      isPublicInterface: isPublic,
      reviewDomainHints: inferReviewDomains(nodeId),
    });
  }

  return sortByKeys(entries, [e => e.nodeId]);
}

function inferReviewDomains(nodeId: string): string[] {
  const domains: string[] = [];
  if (nodeId.startsWith('software::')) domains.push('software');
  if (nodeId.startsWith('firmware::')) domains.push('firmware');
  if (nodeId.startsWith('schematic::')) domains.push('electrical');
  if (nodeId.startsWith('pcb::')) domains.push('pcb');
  if (nodeId.startsWith('bom::')) domains.push('supply_chain');
  if (nodeId.startsWith('constraint::')) {
    if (nodeId.includes('thermal')) domains.push('thermal');
    if (nodeId.includes('manufacturing')) domains.push('manufacturing');
    if (nodeId.includes('electrical')) domains.push('electrical');
    if (nodeId.includes('mechanical')) domains.push('mechanical');
    if (domains.length === 0) domains.push('project_policy');
  }
  return domains.sort();
}

export function edgesToNdjson(edges: GraphEdge[]): string {
  return edges.map(e => jcsCanonicalize(e)).join('\n') + '\n';
}
