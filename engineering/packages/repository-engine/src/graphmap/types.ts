export type EdgeType =
  | 'DECLARES' | 'EXPORTS' | 'IMPORTS' | 'REEXPORTS'
  | 'CALLS' | 'EXTENDS' | 'IMPLEMENTS' | 'OVERRIDES'
  | 'READS_CONFIG' | 'WRITES_CONFIG'
  | 'CONTAINS' | 'CONNECTS_TO' | 'HAS_PIN' | 'ASSIGNED_TO_NET'
  | 'REALIZED_BY' | 'MOUNTED_AS' | 'HAS_PAD' | 'ROUTED_ON'
  | 'POWERED_BY' | 'CLOCKED_BY' | 'COMMUNICATES_VIA'
  | 'EXPOSES_INTERFACE' | 'TEST_POINT_FOR'
  | 'IMPLEMENTED_BY' | 'CONFIGURED_BY' | 'SOURCED_AS'
  | 'SUBSTITUTE_FOR' | 'CONSTRAINED_BY' | 'VALIDATED_BY'
  | 'DECIDED_BY' | 'AFFECTS' | 'PRODUCES_ARTIFACT' | 'DERIVED_FROM';

export type EdgeResolution =
  | 'direct'
  | 'declared'
  | 'member_resolved'
  | 'structural'
  | 'heuristic'
  | 'unresolved';

export type ConfidenceBasis =
  | 'exact_ast_reference'
  | 'explicit_manifest'
  | 'exact_semantic_key'
  | 'explicit_pin_mapping'
  | 'exact_reference_designator'
  | 'exact_mpn'
  | 'normalized_name_match'
  | 'user_declared_mapping'
  | 'heuristic_name_match';

export type EdgeDomain = 'software' | 'electronics' | 'cross_domain' | 'governance';

export interface EdgeEvidence {
  sourcePath: string;
  semanticLocator: string;
  line?: number;
}

export interface GraphEdge {
  edgeId: string;
  from: string;
  type: EdgeType;
  to: string;
  resolution: EdgeResolution;
  confidenceBasis: ConfidenceBasis;
  domain: EdgeDomain;
  evidence: EdgeEvidence;
}

export interface GraphNode {
  nodeId: string;
  domain: string;
  type: string;
  label: string;
}

export interface SccComponent {
  id: number;
  members: string[];
}

export interface ComponentEdge {
  from: number;
  to: number;
}

export interface CondensedDag {
  originalModuleCount: number;
  originalModuleEdgeCount: number;
  sccCount: number;
  sccMembership: Record<string, number>;
  condensedNodes: SccComponent[];
  condensedEdges: ComponentEdge[];
  topologicalOrder: number[];
  topologicalSortCount: number;
  acyclic: boolean;
}

export interface ImpactIndexEntry {
  nodeId: string;
  directIncoming: number;
  directOutgoing: number;
  affectedDomains: string[];
  blockingConstraints: string[];
  validationSpecs: string[];
  isPublicInterface: boolean;
  reviewDomainHints: string[];
}

export interface GraphManifest {
  schemaVersion: string;
  sourceFingerprintHash: string;
  sourceGitTreeId: string;
  toolchainProfileHash: string;
  nodeCountsByDomain: Record<string, number>;
  edgeCountsByType: Record<string, number>;
  edgeCountsByResolution: Record<string, number>;
  unresolvedRelationshipCount: number;
  generationContentHash: string;
}
