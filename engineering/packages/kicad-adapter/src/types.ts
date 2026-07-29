import type { SExpr } from './sexpr/parser.js';

export interface KicadProjectFiles {
  projectDir: string;
  proFile: string;
  schematicFile: string | null;
  pcbFile: string | null;
  projectName: string;
}

export interface FileDiagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  code?: string;
  location?: unknown;
}

export interface ProjectValidation {
  valid: boolean;
  diagnostics: FileDiagnostic[];
}

export interface SchematicSymbol {
  uuid: string;
  libId: string;
  reference: string;
  value: string;
  footprint: string;
  unit: number;
  inBom: boolean;
  onBoard: boolean;
  isPower: boolean;
  position: { x: number; y: number; angle: number };
  properties: Record<string, string>;
}

export interface ParsedSchematic {
  uuid: string;
  version: number;
  generator: string;
  sheetName: string;
  sourcePath: string;
  symbols: SchematicSymbol[];
  raw: SExpr[];
}

export interface PcbNet {
  ordinal: number;
  name: string;
}

export interface PcbPad {
  number: string;
  padType: string;
  shape: string;
  netOrdinal: number | null;
  netName: string | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface PcbFootprint {
  uuid: string;
  libId: string;
  reference: string;
  value: string;
  layer: string;
  position: { x: number; y: number; angle: number };
  pads: PcbPad[];
}

export interface PcbTrack {
  uuid: string;
  kind: 'segment' | 'arc';
  start: { x: number; y: number };
  end: { x: number; y: number };
  width: number;
  layer: string;
  netOrdinal: number;
}

export interface PcbVia {
  uuid: string;
  position: { x: number; y: number };
  size: number;
  drill: number;
  layers: string[];
  netOrdinal: number;
}

export interface PcbZone {
  uuid: string;
  netOrdinal: number;
  netName: string;
  layer: string;
}

export interface PcbLayer {
  ordinal: number;
  name: string;
  kind: string;
}

export interface BoardOutlineSegment {
  uuid: string;
  kind: string;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

export interface ParsedPcb {
  version: number;
  generator: string;
  sourcePath: string;
  nets: PcbNet[];
  footprints: PcbFootprint[];
  tracks: PcbTrack[];
  vias: PcbVia[];
  zones: PcbZone[];
  layers: PcbLayer[];
  outline: BoardOutlineSegment[];
  raw: SExpr[];
}

export interface BomItem {
  value: string;
  footprint: string;
  references: string[];
  quantity: number;
  libId: string;
}

export interface ToolMetadata {
  tool: 'kicad-cli';
  available: boolean;
  versionString: string | null;
  majorVersion: number | null;
  pinnedMajorVersion: number;
  supported: boolean;
}

export type CheckStatus = 'pass' | 'warning' | 'fail' | 'error' | 'skipped';

export interface CheckResult {
  status: CheckStatus;
  diagnostics: FileDiagnostic[];
  /** Raw JSON report emitted by kicad-cli, when it ran. */
  report: Buffer | null;
  toolVersion: string | null;
}

export interface RenderResult {
  filename: string;
  mediaType: 'image/svg+xml';
  content: Buffer;
  toolVersion: string;
}
