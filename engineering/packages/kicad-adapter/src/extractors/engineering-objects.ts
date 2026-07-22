import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { EngineeringObjectSchema, type EngineeringObject } from '@logichub-engineering/contracts';
import type { BomItem, ParsedPcb, ParsedSchematic } from '../types.js';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/** JSON with recursively sorted object keys, so hashing is deterministic. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export interface ExtractionContext {
  projectId: string;
  revisionId: string;
  createdAt: string;
}

interface ObjectSpec {
  objectType: string;
  sourcePath: string;
  sourceObjectId?: string;
  name: string;
  semanticKey: string;
  properties: Record<string, unknown>;
  geometry?: Record<string, unknown>;
}

/**
 * contentHash covers semantic properties AND geometry; semanticHash covers
 * semantic properties only — a pure move changes contentHash but leaves
 * semanticHash intact, which is what the diff engine keys off later.
 */
function buildObject(ctx: ExtractionContext, spec: ObjectSpec): EngineeringObject {
  const semanticPayload = canonicalJson({ objectType: spec.objectType, name: spec.name, properties: spec.properties });
  const contentPayload = canonicalJson({
    objectType: spec.objectType, name: spec.name,
    properties: spec.properties, geometry: spec.geometry ?? null,
  });
  return EngineeringObjectSchema.parse({
    id: `eo-${sha256Hex(`${ctx.revisionId}/${spec.semanticKey}`).slice(0, 24)}`,
    schemaVersion: '0.1.0',
    projectId: ctx.projectId,
    revisionId: ctx.revisionId,
    objectType: spec.objectType,
    sourcePath: spec.sourcePath,
    sourceObjectId: spec.sourceObjectId,
    name: spec.name,
    semanticKey: spec.semanticKey,
    properties: spec.properties,
    relationships: [],
    geometry: spec.geometry,
    contentHash: sha256Hex(contentPayload),
    semanticHash: sha256Hex(semanticPayload),
    createdAt: ctx.createdAt,
    metadata: undefined,
  });
}

export function schematicToObjects(ctx: ExtractionContext, sch: ParsedSchematic): EngineeringObject[] {
  const source = basename(sch.sourcePath);
  const objects: EngineeringObject[] = [];

  objects.push(buildObject(ctx, {
    objectType: 'schematic_sheet',
    sourcePath: source,
    sourceObjectId: sch.uuid,
    name: sch.sheetName,
    semanticKey: `sheet:${source}`,
    properties: { generator: sch.generator, fileVersion: sch.version, symbolCount: sch.symbols.length },
  }));

  for (const sym of sch.symbols) {
    if (sym.isPower) continue;
    objects.push(buildObject(ctx, {
      objectType: 'component',
      sourcePath: source,
      sourceObjectId: sym.uuid,
      name: sym.reference,
      semanticKey: `component:${sym.reference}`,
      properties: {
        reference: sym.reference,
        value: sym.value,
        footprint: sym.footprint,
        libId: sym.libId,
        inBom: sym.inBom,
        onBoard: sym.onBoard,
      },
      geometry: { x: sym.position.x, y: sym.position.y, angle: sym.position.angle },
    }));
  }

  return objects;
}

export function pcbToObjects(ctx: ExtractionContext, pcb: ParsedPcb): EngineeringObject[] {
  const source = basename(pcb.sourcePath);
  const objects: EngineeringObject[] = [];

  objects.push(buildObject(ctx, {
    objectType: 'pcb',
    sourcePath: source,
    name: source,
    semanticKey: `pcb:${source}`,
    properties: {
      generator: pcb.generator,
      fileVersion: pcb.version,
      netCount: pcb.nets.filter(n => n.name.length > 0).length,
      footprintCount: pcb.footprints.length,
    },
  }));

  for (const layer of pcb.layers) {
    if (layer.kind !== 'signal') continue;
    objects.push(buildObject(ctx, {
      objectType: 'layer',
      sourcePath: source,
      name: layer.name,
      semanticKey: `layer:${layer.name}`,
      properties: { ordinal: layer.ordinal, kind: layer.kind },
    }));
  }

  for (const net of pcb.nets) {
    if (net.name.length === 0) continue;
    objects.push(buildObject(ctx, {
      objectType: 'net',
      sourcePath: source,
      name: net.name,
      semanticKey: `net:${net.name}`,
      properties: {
        name: net.name,
        padCount: pcb.footprints.reduce(
          (acc, fp) => acc + fp.pads.filter(p => p.netOrdinal === net.ordinal).length, 0),
      },
    }));
  }

  for (const fp of pcb.footprints) {
    objects.push(buildObject(ctx, {
      objectType: 'footprint',
      sourcePath: source,
      sourceObjectId: fp.uuid,
      name: fp.reference,
      semanticKey: `footprint:${fp.reference}`,
      properties: {
        reference: fp.reference,
        value: fp.value,
        libId: fp.libId,
        layer: fp.layer,
        padCount: fp.pads.length,
        padNets: fp.pads.map(p => ({ number: p.number, net: p.netName })),
      },
      geometry: { x: fp.position.x, y: fp.position.y, angle: fp.position.angle },
    }));

    for (const pad of fp.pads) {
      objects.push(buildObject(ctx, {
        objectType: 'pad',
        sourcePath: source,
        name: `${fp.reference}.${pad.number}`,
        semanticKey: `pad:${fp.reference}.${pad.number}`,
        properties: {
          footprint: fp.reference,
          number: pad.number,
          padType: pad.padType,
          shape: pad.shape,
          net: pad.netName,
        },
        geometry: {
          x: pad.position.x, y: pad.position.y,
          width: pad.size.width, height: pad.size.height,
        },
      }));
    }
  }

  for (const track of pcb.tracks) {
    objects.push(buildObject(ctx, {
      objectType: 'track',
      sourcePath: source,
      sourceObjectId: track.uuid,
      name: `track ${track.uuid.slice(0, 8)}`,
      semanticKey: `track:${track.uuid}`,
      properties: { layer: track.layer, width: track.width, net: track.netOrdinal, kind: track.kind },
      geometry: { start: track.start, end: track.end },
    }));
  }

  for (const via of pcb.vias) {
    objects.push(buildObject(ctx, {
      objectType: 'via',
      sourcePath: source,
      sourceObjectId: via.uuid,
      name: `via ${via.uuid.slice(0, 8)}`,
      semanticKey: `via:${via.uuid}`,
      properties: { size: via.size, drill: via.drill, layers: via.layers, net: via.netOrdinal },
      geometry: { x: via.position.x, y: via.position.y },
    }));
  }

  for (const zone of pcb.zones) {
    objects.push(buildObject(ctx, {
      objectType: 'zone',
      sourcePath: source,
      sourceObjectId: zone.uuid,
      name: `zone ${zone.netName || zone.uuid.slice(0, 8)}`,
      semanticKey: `zone:${zone.uuid}`,
      properties: { net: zone.netName, layer: zone.layer },
    }));
  }

  if (pcb.outline.length > 0) {
    objects.push(buildObject(ctx, {
      objectType: 'board_outline',
      sourcePath: source,
      name: 'board outline',
      semanticKey: `board_outline:${source}`,
      properties: { segmentCount: pcb.outline.length, kinds: pcb.outline.map(o => o.kind) },
      geometry: { segments: pcb.outline.map(o => ({ kind: o.kind, start: o.start, end: o.end })) },
    }));
  }

  return objects;
}

export function bomToObjects(ctx: ExtractionContext, sourcePath: string, bom: BomItem[]): EngineeringObject[] {
  const source = basename(sourcePath);
  return bom.map(item => buildObject(ctx, {
    objectType: 'bom_item',
    sourcePath: source,
    name: `${item.value} (${item.footprint || 'no footprint'})`,
    semanticKey: `bom_item:${item.value}|${item.footprint}`,
    properties: {
      value: item.value,
      footprint: item.footprint,
      references: item.references,
      quantity: item.quantity,
      libId: item.libId,
    },
  }));
}
