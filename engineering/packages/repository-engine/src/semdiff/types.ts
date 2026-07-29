export type DeltaType =
  | 'API_ADDED' | 'API_REMOVED' | 'SIGNATURE_CHANGED' | 'CAPABILITY_MOVED'
  | 'IMPLEMENTATION_CHANGED' | 'ENTRY_POINT_ADDED' | 'ENTRY_POINT_REMOVED'
  | 'DEPENDENCY_ADDED' | 'DEPENDENCY_REMOVED'
  | 'CALL_RELATION_ADDED' | 'CALL_RELATION_REMOVED' | 'COVERAGE_DELTA'
  | 'SHEET_ADDED' | 'SHEET_REMOVED'
  | 'SYMBOL_ADDED' | 'SYMBOL_REMOVED' | 'SYMBOL_MOVED'
  | 'SYMBOL_VALUE_CHANGED' | 'SYMBOL_FOOTPRINT_CHANGED'
  | 'PIN_MAPPING_CHANGED' | 'NET_ADDED' | 'NET_REMOVED' | 'NET_RENAMED'
  | 'NET_MEMBERSHIP_CHANGED' | 'INTERFACE_ADDED' | 'INTERFACE_REMOVED'
  | 'POWER_TOPOLOGY_CHANGED'
  | 'FOOTPRINT_ADDED' | 'FOOTPRINT_REMOVED' | 'FOOTPRINT_MOVED'
  | 'FOOTPRINT_CHANGED' | 'PAD_CHANGED' | 'LAYER_CHANGED'
  | 'BOARD_OUTLINE_CHANGED' | 'TRACK_TOPOLOGY_CHANGED'
  | 'VIA_CHANGED' | 'ZONE_CHANGED' | 'DESIGN_RULE_CHANGED'
  | 'STACKUP_CHANGED' | 'TEST_POINT_CHANGED'
  | 'BOM_ITEM_ADDED' | 'BOM_ITEM_REMOVED' | 'QUANTITY_CHANGED'
  | 'MPN_CHANGED' | 'SUPPLIER_CHANGED'
  | 'SUBSTITUTE_ADDED' | 'SUBSTITUTE_REMOVED'
  | 'LIFECYCLE_STATUS_CHANGED' | 'COST_BASIS_CHANGED'
  | 'CONSTRAINT_ADDED' | 'CONSTRAINT_REMOVED' | 'CONSTRAINT_CHANGED'
  | 'CONSTRAINT_SCOPE_CHANGED'
  | 'DECISION_ADDED' | 'DECISION_SUPERSEDED' | 'DECISION_AFFECTED'
  | 'VALIDATION_REQUIRED' | 'VALIDATION_CONFIG_CHANGED'
  | 'EVIDENCE_STALE' | 'EVIDENCE_UNAFFECTED'
  | 'RELATION_ADDED' | 'RELATION_REMOVED'
  | 'CROSS_DOMAIN_IMPACT' | 'REVIEW_DOMAIN_REQUIRED';

export type DeltaDomain =
  | 'software' | 'firmware' | 'schematic' | 'pcb'
  | 'bom' | 'constraint' | 'decision' | 'validation'
  | 'graph' | 'cross_domain';

export interface DeltaRecord {
  schemaVersion: string;
  deltaType: DeltaType;
  domain: DeltaDomain;
  recordId: string;
  oldSemanticId: string | null;
  newSemanticId: string | null;
  oldSemanticHash: string | null;
  newSemanticHash: string | null;
  oldNormalizedValue: string | null;
  newNormalizedValue: string | null;
  affectedNodeIds: string[];
  supportingEdgeIds: string[];
  evidenceSourcePaths: string[];
  classificationBasis: string;
  replayOperation: ReplayOperation;
  reviewDomains: string[];
  validationImplications: string[];
}

export interface ReplayOperation {
  operation: 'add' | 'remove' | 'replace' | 'move';
  objectId: string;
  expectedOldHash: string | null;
  expectedAbsent?: boolean;
  newObject?: {
    semanticId: string;
    semanticHash: string;
  };
  oldObjectId?: string;
  newObjectId?: string;
  expectedBodyHash?: string;
}

export interface ImpactRecord {
  sourceChangeId: string;
  affectedNodeId: string;
  affectedDomain: string;
  impactPath: string[];
  severity: 'info' | 'warning' | 'critical';
  reviewDomain: string;
}

export interface StalenessRecord {
  validationId: string;
  targetNodeId: string;
  reason: string;
  isStale: boolean;
}

export interface EngineeringPrSummary {
  schemaVersion: string;
  baseRevisionIdentity: { gitTreeId: string; descriptorHash: string };
  targetRevisionIdentity: { gitTreeId: string; descriptorHash: string };
  changeCountsByDomain: Record<string, number>;
  changeCountsByType: Record<string, number>;
  breakingSoftwareChanges: string[];
  changedExternalInterfaces: string[];
  changedNets: string[];
  changedComponentMappings: string[];
  bomRiskChanges: string[];
  affectedBlockingConstraints: string[];
  validationsRequired: string[];
  staleEvidence: StalenessRecord[];
  reviewDomainsRequired: string[];
  unknownMappings: string[];
  deterministicMergeBlockers: string[];
}
