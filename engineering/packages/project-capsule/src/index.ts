export { canonicalize, canonicalCompact } from './canonical/canonical-json.js';
export { sha256Hex, hashValue, byteLength } from './canonical/hashing.js';

export {
  Sha256HexSchema,
  CapsuleFileEntrySchema, type CapsuleFileEntry,
  ExternalReferenceSchema, type ExternalReference,
  ToolVersionsSchema, type ToolVersions,
  CapsuleManifestSchema, type CapsuleManifest,
  CapsuleFileSchema, type CapsuleFile,
  CapsuleSchema, type Capsule,
  CAPSULE_FORMAT_ID,
  CAPSULE_VERSION,
  MANIFEST_PATH,
  CHECKSUMS_PATH,
  comparePaths,
} from './schemas/capsule.schema.js';

export {
  VerificationSeveritySchema, type VerificationSeverity,
  VerificationFindingSchema, type VerificationFinding,
  VerificationResultSchema, type VerificationResult,
} from './schemas/verification.schema.js';

export {
  buildCapsule,
  renderChecksums,
  capsuleByteSize,
  PRODUCT_GRAPH_PACKAGE_VERSION,
  type BuildCapsuleOptions,
} from './build/capsule-builder.js';

export { buildSections, type SectionFile } from './build/sections.js';

export { verifyCapsule } from './verify/capsule-verifier.js';

export {
  serializeCapsule,
  parseCapsule,
  importProductGraph,
} from './io/capsule-io.js';
