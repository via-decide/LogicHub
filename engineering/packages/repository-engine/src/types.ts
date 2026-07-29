export type DomainClass =
  | 'software'
  | 'firmware'
  | 'electronics'
  | 'bom'
  | 'constraint'
  | 'decision'
  | 'documentation'
  | 'configuration'
  | 'test'
  | 'build'
  | 'vendor'
  | 'generated'
  | 'unknown';

export type FileClassification = 'source' | 'generated' | 'vendor' | 'test';

export type ParseStatus = 'ok' | 'partial' | 'unparseable' | 'skipped';

export interface SourceFileEntry {
  path: string;
  blobId: string;
  byteSize: number;
  mode: string;
  domainClass: DomainClass;
  language: string | null;
  classification: FileClassification;
  parserProfile: string;
  parseStatus: ParseStatus;
  contentHash: string;
}

export interface ExportedSymbol {
  semanticId: string;
  name: string;
  kind: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum' | 'const' | 'unknown';
  normalizedSignature: string;
  bodyHash: string;
  alphaNormalizedBodyHash: string;
}

export interface ImportRecord {
  source: string;
  specifiers: string[];
  isRelative: boolean;
  isDynamic: boolean;
}

export interface EntryPoint {
  domain: DomainClass;
  sourceType: string;
  normalizedPath: string;
  semanticId: string;
}

export interface SoftwareFileSurface {
  path: string;
  language: string;
  primaryLanguage: string;
  secondaryLanguages: string[];
  namedAstNodeCount: number;
  fileCount: 1;
  byteCount: number;
  entryPoints: EntryPoint[];
  exportedSymbols: ExportedSymbol[];
  normalizedSignatures: string[];
  bodyHash: string;
  alphaNormalizedBodyHash: string;
  imports: ImportRecord[];
  assertionSiteCount: number;
  exportedSymbolCount: number;
  assertionDensityBasisPoints: number;
}

export interface SchematicSheetSummary {
  path: string;
  name: string;
  semanticHash: string;
}

export interface SymbolSummary {
  reference: string;
  value: string;
  footprint: string;
  libId: string;
  mpn: string | null;
  pinCount: number;
  semanticHash: string;
  semanticId: string;
}

export interface NetSummary {
  name: string;
  semanticHash: string;
  semanticId: string;
  connectedPins: string[];
}

export interface SchematicSurface {
  projectFiles: string[];
  sheets: SchematicSheetSummary[];
  symbols: SymbolSummary[];
  referenceDesignators: string[];
  values: string[];
  footprints: string[];
  mpns: string[];
  totalPins: number;
  nets: NetSummary[];
  labels: string[];
  hierarchicalLabels: string[];
  powerSymbols: string[];
  buses: string[];
  noConnectMarkers: number;
  sheetHierarchy: string[];
  symbolSemanticHashes: string[];
  netSemanticHashes: string[];
  declaredExternalInterfaces: string[];
}

export interface FootprintSummary {
  reference: string;
  footprint: string;
  layer: string;
  padCount: number;
  semanticId: string;
}

export interface PadSummary {
  footprintRef: string;
  padNumber: string;
  net: string;
  semanticId: string;
}

export interface LayerSummary {
  ordinal: number;
  name: string;
  type: string;
}

export interface OutlineSummary {
  segmentCount: number;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number } | null;
  semanticHash: string;
}

export interface PcbSurface {
  boardIdentity: string;
  footprints: FootprintSummary[];
  pads: PadSummary[];
  nets: string[];
  layers: LayerSummary[];
  boardOutline: OutlineSummary | null;
  trackCount: number;
  viaCount: number;
  zoneCount: number;
  differentialPairs: string[];
  designRuleClasses: string[];
  clearances: Record<string, number>;
  stackUpMetadata: Record<string, unknown> | null;
  testPoints: string[];
  mountingHoles: string[];
  pcbSemanticHash: string;
}

export interface BomGroupSummary {
  referenceGroup: string[];
  quantity: number;
  value: string;
  footprint: string;
  manufacturer: string;
  mpn: string;
  supplierIds: Record<string, string>;
  approvedAlternatives: string[];
  lifecycleStatus: string | null;
  unitCost: string | null;
  semanticHash: string;
}

export interface BomSurface {
  groups: BomGroupSummary[];
  totalQuantity: number;
  uniqueParts: number;
}

export interface ConstraintSummaryEntry {
  id: string;
  category: string;
  severity: string;
  targetSemanticKeys: string[];
  normalizedExpression: string;
  unit: string | null;
  expectedValue: string | null;
  source: string | null;
  semanticHash: string;
}

export interface ConstraintSurface {
  constraints: ConstraintSummaryEntry[];
}

export interface DecisionSummaryEntry {
  id: string;
  subject: string;
  selectedOptionHash: string | null;
  affectedSemanticKeys: string[];
  status: string;
}

export interface DecisionSurface {
  decisions: DecisionSummaryEntry[];
}

export interface ValidationConfigEntry {
  id: string;
  validationType: string;
  requiredTypes: string[];
  testSpecifications: string[];
  evidenceRequirements: string[];
}

export interface ValidationConfigSurface {
  configs: ValidationConfigEntry[];
  configuredErcDrcProfiles: string[];
}

export interface ToolchainProfile {
  profileId: string;
  canonicalizationProfile: string;
  descriptorHashAlgorithm: string;
  kicadParserVersion: string;
  softwareParserRuntime: string;
  softwareParserVersion: string;
  grammars: Record<string, string>;
  resolverRules: string;
  signatureNormalization: string;
  pathNormalization: string;
  unicodeNormalization: string;
  jcsImplementation: string;
  jcsVersion: string;
}

export interface FingerprintIdentity {
  schemaVersion: string;
  fingerprintContractId: string;
  gitTreeId: string;
  gitObjectFormat: string;
  toolchainProfileId: string;
  toolchainProfileHash: string;
  canonicalizationProfile: string;
  descriptorHashAlgorithm: string;
}

export interface FingerprintDescriptor {
  identity: FingerprintIdentity;
  sourceInventory: SourceFileEntry[];
  softwareSurface: SoftwareFileSurface[];
  schematicSurface: SchematicSurface | null;
  pcbSurface: PcbSurface | null;
  bomSurface: BomSurface | null;
  constraintSurface: ConstraintSurface | null;
  decisionSurface: DecisionSurface | null;
  validationConfigSurface: ValidationConfigSurface | null;
  descriptorHash: string;
}

export interface FingerprintDiagnostics {
  generatedAt: string;
  durationMs: number;
  fileCount: number;
  parsedFileCount: number;
  skippedFileCount: number;
  unparseableFileCount: number;
  warnings: string[];
  errors: string[];
}
