export { buildFingerprint } from './fingerprint/fingerprint.js';
export type { FingerprintOptions, FingerprintResult } from './fingerprint/fingerprint.js';

export { buildGraphMap, edgesToNdjson } from './graphmap/graphmap.js';
export type { GraphMapResult } from './graphmap/graphmap.js';

export { computeSemDiff } from './semdiff/semdiff.js';
export type { SemDiffInput, SemDiffResult } from './semdiff/semdiff.js';

export { buildReplayDocument, verifyReplay, applyReplay, materializeCapabilityState } from './semdiff/replay-builder.js';
export type { ReplayDocument, CapabilityState } from './semdiff/replay-builder.js';

export { generateDeltas } from './semdiff/delta-emitter.js';
export { analyzeImpact, detectStaleEvidence } from './semdiff/impact-analyzer.js';
export { buildPrSummary } from './semdiff/pr-summary-builder.js';
export { detectFileMoves, detectSymbolMoves } from './semdiff/move-detector.js';

export { computeScc } from './graphmap/tarjan.js';
export type { CondensedDag } from './graphmap/types.js';
export type { GraphEdge, GraphManifest, ImpactIndexEntry } from './graphmap/types.js';

export type {
  DomainClass, FileClassification, ParseStatus, SourceFileEntry,
  ExportedSymbol, ImportRecord, EntryPoint, SoftwareFileSurface,
  SchematicSurface, PcbSurface, BomSurface,
  ConstraintSurface, DecisionSurface,
  FingerprintDescriptor, FingerprintIdentity, FingerprintDiagnostics,
  ToolchainProfile,
} from './types.js';

export type {
  DeltaType, DeltaDomain, DeltaRecord, ReplayOperation,
  ImpactRecord, StalenessRecord, EngineeringPrSummary,
} from './semdiff/types.js';

export { sha256Hex, sha256OfCanonical } from './util/hash.js';
export { jcsCanonicalize } from './util/jcs.js';
export { sortByKeys, sortStrings } from './util/deterministic.js';
