export type {
  KicadProjectFiles, FileDiagnostic, ProjectValidation,
  SchematicSymbol, ParsedSchematic,
  PcbNet, PcbPad, PcbFootprint, PcbTrack, PcbVia, PcbZone, PcbLayer,
  BoardOutlineSegment, ParsedPcb,
  BomItem,
  ToolMetadata, CheckStatus, CheckResult, RenderResult,
} from './types.js';

export type { SExpr } from './sexpr/parser.js';
export { parseKicadFile, parseSExpr, findChildren, findChild, getStringAtom, getNumberAtom } from './sexpr/parser.js';

export { inspectProject, validateProjectFiles } from './project-inspector.js';
export { parseSchematic } from './extractors/schematic-extractor.js';
export { parsePcb } from './extractors/pcb-extractor.js';
export { extractBom } from './extractors/bom-extractor.js';
export {
  sha256Hex, canonicalJson,
  schematicToObjects, pcbToObjects, bomToObjects,
  type ExtractionContext,
} from './extractors/engineering-objects.js';

export { ToolExecutor, type ToolExecutorOptions, type ToolCommandAudit, type ToolCommandResult } from './kicad-executor.js';
export { collectToolMetadata, detectCapabilities, assertSupportedVersion, PINNED_KICAD_MAJOR, SUPPORTED_KICAD_VERSIONS, type ToolchainCapabilities } from './toolchain.js';
export { KicadAdapter, type KicadAdapterOptions } from './operations.js';
