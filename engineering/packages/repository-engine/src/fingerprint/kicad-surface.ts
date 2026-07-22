import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GitExecutor } from '@logichub-engineering/git-adapter';
import {
  inspectProject, parseSchematic, parsePcb, extractBom,
} from '@logichub-engineering/kicad-adapter';
import type {
  SchematicSurface, PcbSurface, BomSurface,
  SchematicSheetSummary, SymbolSummary, NetSummary,
  FootprintSummary, PadSummary, LayerSummary, OutlineSummary,
  BomGroupSummary,
} from '../types.js';
import { sha256Hex, canonicalJson } from '../util/hash.js';
import { sortByKey, sortByKeys, sortStrings } from '../util/deterministic.js';
import { readBlobString, listTreeEntries } from './git-inventory.js';

export async function extractKicadSurfaces(
  executor: GitExecutor,
  repoPath: string,
  treeSha: string,
): Promise<{
  schematic: SchematicSurface | null;
  pcb: PcbSurface | null;
  bom: BomSurface | null;
}> {
  const entries = await listTreeEntries(executor, repoPath, treeSha);
  const kicadFiles = entries.filter(e =>
    e.path.endsWith('.kicad_pro') ||
    e.path.endsWith('.kicad_sch') ||
    e.path.endsWith('.kicad_pcb'),
  );

  if (kicadFiles.length === 0) {
    return { schematic: null, pcb: null, bom: null };
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'logichub-kicad-'));
  try {
    for (const file of kicadFiles) {
      const content = await readBlobString(executor, repoPath, file.blobId);
      const filePath = join(tempDir, file.path);
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, content, 'utf-8');
    }

    const proDirs = new Set<string>();
    for (const f of kicadFiles) {
      if (f.path.endsWith('.kicad_pro')) {
        proDirs.add(join(tempDir, f.path, '..'));
      }
    }

    let schematic: SchematicSurface | null = null;
    let pcb: PcbSurface | null = null;
    let bom: BomSurface | null = null;

    for (const dir of proDirs) {
      const project = await inspectProject(dir);

      if (project.schematicFile) {
        const parsed = await parseSchematic(project.schematicFile);
        schematic = buildSchematicSurface(parsed, kicadFiles.map(f => f.path));
        bom = buildBomSurface(parsed);
      }

      if (project.pcbFile) {
        const parsed = await parsePcb(project.pcbFile);
        pcb = buildPcbSurface(parsed);
      }
    }

    return { schematic, pcb, bom };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function buildSchematicSurface(
  parsed: Awaited<ReturnType<typeof parseSchematic>>,
  projectFiles: string[],
): SchematicSurface {
  const symbols: SymbolSummary[] = [];
  const allPins: string[] = [];
  const nets: NetSummary[] = [];
  const powerSymbols: string[] = [];
  const referenceDesignators: string[] = [];
  const values: string[] = [];
  const footprints: string[] = [];
  const mpns: string[] = [];

  for (const sym of parsed.symbols) {
    const pinCount = sym.properties?.pins ? parseInt(String(sym.properties.pins), 10) || 0 : 0;
    const mpn = sym.properties?.['MPN'] as string | undefined ?? null;

    const semanticId = `schematic::${sym.reference}`;
    const symHash = sha256Hex(canonicalJson({
      reference: sym.reference,
      value: sym.value,
      footprint: sym.footprint,
      libId: sym.libId,
    }));

    symbols.push({
      reference: sym.reference,
      value: sym.value,
      footprint: sym.footprint,
      libId: sym.libId,
      mpn,
      pinCount,
      semanticHash: symHash,
      semanticId,
    });

    referenceDesignators.push(sym.reference);
    if (sym.value) values.push(sym.value);
    if (sym.footprint) footprints.push(sym.footprint);
    if (mpn) mpns.push(mpn);
    if (sym.isPower) powerSymbols.push(sym.reference);
  }

  const symbolSemanticHashes = sortStrings(symbols.map(s => s.semanticHash));
  const netSemanticHashes: string[] = [];

  return {
    projectFiles: sortStrings(projectFiles.filter(f =>
      f.endsWith('.kicad_pro') || f.endsWith('.kicad_sch'))),
    sheets: [{
      path: 'root',
      name: 'root',
      semanticHash: sha256Hex(canonicalJson({ sheet: 'root', symbols: symbolSemanticHashes })),
    }],
    symbols: sortByKey(symbols, s => s.reference),
    referenceDesignators: sortStrings(referenceDesignators),
    values: sortStrings([...new Set(values)]),
    footprints: sortStrings([...new Set(footprints)]),
    mpns: sortStrings([...new Set(mpns)]),
    totalPins: allPins.length || symbols.reduce((sum, s) => sum + s.pinCount, 0),
    nets: sortByKey(nets, n => n.name),
    labels: [],
    hierarchicalLabels: [],
    powerSymbols: sortStrings(powerSymbols),
    buses: [],
    noConnectMarkers: 0,
    sheetHierarchy: ['root'],
    symbolSemanticHashes,
    netSemanticHashes,
    declaredExternalInterfaces: [],
  };
}

function buildPcbSurface(parsed: Awaited<ReturnType<typeof parsePcb>>): PcbSurface {
  const footprints: FootprintSummary[] = [];
  const pads: PadSummary[] = [];
  const testPoints: string[] = [];
  const mountingHoles: string[] = [];

  for (const fp of parsed.footprints) {
    footprints.push({
      reference: fp.reference,
      footprint: fp.libId,
      layer: fp.layer,
      padCount: fp.pads.length,
      semanticId: `pcb::${fp.reference}`,
    });

    for (const pad of fp.pads) {
      pads.push({
        footprintRef: fp.reference,
        padNumber: pad.number,
        net: pad.netName ?? '',
        semanticId: `pcb::${fp.reference}::pad::${pad.number}`,
      });
    }

    const refLower = fp.reference.toLowerCase();
    if (refLower.startsWith('tp')) testPoints.push(fp.reference);
    if (refLower.startsWith('mh') || refLower.startsWith('h')) mountingHoles.push(fp.reference);
  }

  const layers: LayerSummary[] = parsed.layers.map((l, i) => ({
    ordinal: l.ordinal,
    name: l.name,
    type: l.kind,
  }));

  const outline: OutlineSummary | null = parsed.outline.length > 0
    ? {
      segmentCount: parsed.outline.length,
      boundingBox: computeBoundingBox(parsed.outline),
      semanticHash: sha256Hex(canonicalJson(
        parsed.outline.map(s => ({
          kind: s.kind,
          startX: s.start?.x ?? 0, startY: s.start?.y ?? 0,
          endX: s.end?.x ?? 0, endY: s.end?.y ?? 0,
        })),
      )),
    }
    : null;

  const pcbSemanticHash = sha256Hex(canonicalJson({
    footprints: footprints.map(f => f.semanticId).sort(),
    nets: parsed.nets.map(n => n.name).sort(),
    layers: layers.map(l => l.name).sort(),
  }));

  return {
    boardIdentity: 'pcb::board',
    footprints: sortByKey(footprints, f => f.reference),
    pads: sortByKeys(pads, [p => p.footprintRef, p => p.padNumber]),
    nets: sortStrings(parsed.nets.map(n => n.name)),
    layers: sortByKey(layers, l => l.name),
    boardOutline: outline,
    trackCount: parsed.tracks.length,
    viaCount: parsed.vias.length,
    zoneCount: parsed.zones.length,
    differentialPairs: [],
    designRuleClasses: [],
    clearances: {},
    stackUpMetadata: null,
    testPoints: sortStrings(testPoints),
    mountingHoles: sortStrings(mountingHoles),
    pcbSemanticHash,
  };
}

function buildBomSurface(parsed: Awaited<ReturnType<typeof parseSchematic>>): BomSurface {
  const bomItems = extractBom(parsed);
  const groups: BomGroupSummary[] = bomItems.map(item => ({
    referenceGroup: sortStrings(item.references),
    quantity: item.quantity,
    value: item.value,
    footprint: item.footprint,
    manufacturer: '',
    mpn: '',
    supplierIds: {},
    approvedAlternatives: [],
    lifecycleStatus: null,
    unitCost: null,
    semanticHash: sha256Hex(canonicalJson({
      value: item.value,
      footprint: item.footprint,
      references: sortStrings(item.references),
    })),
  }));

  return {
    groups: sortByKeys(groups, [g => g.mpn || '', g => g.referenceGroup.join(',')]),
    totalQuantity: groups.reduce((sum, g) => sum + g.quantity, 0),
    uniqueParts: groups.length,
  };
}

function computeBoundingBox(segments: Array<{ start?: { x: number; y: number }; end?: { x: number; y: number } }>): {
  minX: number; minY: number; maxX: number; maxY: number;
} | null {
  if (segments.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of segments) {
    const sx = s.start?.x ?? 0, sy = s.start?.y ?? 0;
    const ex = s.end?.x ?? 0, ey = s.end?.y ?? 0;
    minX = Math.min(minX, sx, ex);
    minY = Math.min(minY, sy, ey);
    maxX = Math.max(maxX, sx, ex);
    maxY = Math.max(maxY, sy, ey);
  }
  return { minX, minY, maxX, maxY };
}
