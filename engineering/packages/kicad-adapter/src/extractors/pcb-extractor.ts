import { readFile } from 'node:fs/promises';
import { parseKicadFile, findChildren, findChild, getStringAtom, getNumberAtom, type SExpr } from '../sexpr/parser.js';
import type {
  BoardOutlineSegment, ParsedPcb, PcbFootprint, PcbLayer, PcbNet, PcbPad,
  PcbTrack, PcbVia, PcbZone,
} from '../types.js';

function xy(node: SExpr[] | undefined, fallback = { x: 0, y: 0 }): { x: number; y: number } {
  if (!node) return fallback;
  const [, x, y] = node;
  return { x: typeof x === 'number' ? x : 0, y: typeof y === 'number' ? y : 0 };
}

/** v7 files use (tstamp ...); v8 renamed it to (uuid ...). Accept both. */
function objectUuid(node: SExpr[]): string {
  return getStringAtom(node, 'tstamp') ?? getStringAtom(node, 'uuid') ?? '';
}

function readPads(fpNode: SExpr[], netNames: Map<number, string>): PcbPad[] {
  return findChildren(fpNode, 'pad').map(pad => {
    const netChild = findChild(pad, 'net');
    const netOrdinal = netChild && typeof netChild[1] === 'number' ? netChild[1] : null;
    const size = findChild(pad, 'size');
    return {
      number: String(pad[1] ?? ''),
      padType: String(pad[2] ?? ''),
      shape: String(pad[3] ?? ''),
      netOrdinal,
      netName: netOrdinal !== null ? (netNames.get(netOrdinal) ?? null) : null,
      position: xy(findChild(pad, 'at')),
      size: {
        width: size && typeof size[1] === 'number' ? size[1] : 0,
        height: size && typeof size[2] === 'number' ? size[2] : 0,
      },
    };
  });
}

export async function parsePcb(filePath: string): Promise<ParsedPcb> {
  const raw = await readFile(filePath, 'utf-8');
  const root = parseKicadFile(raw, 'kicad_pcb');

  const nets: PcbNet[] = findChildren(root, 'net')
    .map(n => ({ ordinal: typeof n[1] === 'number' ? n[1] : -1, name: String(n[2] ?? '') }))
    .filter(n => n.ordinal >= 0);
  const netNames = new Map(nets.map(n => [n.ordinal, n.name]));

  const layers: PcbLayer[] = [];
  const layersNode = findChild(root, 'layers');
  if (layersNode) {
    for (const entry of layersNode.slice(1)) {
      if (Array.isArray(entry) && typeof entry[0] === 'number') {
        layers.push({
          ordinal: entry[0],
          name: String(entry[1] ?? ''),
          kind: String(entry[2] ?? ''),
        });
      }
    }
  }

  const footprints: PcbFootprint[] = findChildren(root, 'footprint').map(fp => {
    const at = findChild(fp, 'at');
    const props: Record<string, string> = {};
    for (const text of findChildren(fp, 'fp_text')) {
      const kind = text[1];
      const value = text[2];
      if (typeof kind === 'string' && !Array.isArray(value) && value !== undefined) {
        props[kind] = String(value);
      }
    }
    return {
      uuid: objectUuid(fp),
      libId: String(fp[1] ?? ''),
      reference: props['reference'] ?? '?',
      value: props['value'] ?? '',
      layer: getStringAtom(fp, 'layer') ?? '',
      position: {
        ...xy(at),
        angle: at && typeof at[3] === 'number' ? at[3] : 0,
      },
      pads: readPads(fp, netNames),
    };
  });

  const tracks: PcbTrack[] = [...findChildren(root, 'segment'), ...findChildren(root, 'arc')].map(seg => ({
    uuid: objectUuid(seg),
    kind: seg[0] === 'arc' ? 'arc' as const : 'segment' as const,
    start: xy(findChild(seg, 'start')),
    end: xy(findChild(seg, 'end')),
    width: getNumberAtom(seg, 'width') ?? 0,
    layer: getStringAtom(seg, 'layer') ?? '',
    netOrdinal: getNumberAtom(seg, 'net') ?? 0,
  }));

  const vias: PcbVia[] = findChildren(root, 'via').map(via => {
    const layersChild = findChild(via, 'layers');
    return {
      uuid: objectUuid(via),
      position: xy(findChild(via, 'at')),
      size: getNumberAtom(via, 'size') ?? 0,
      drill: getNumberAtom(via, 'drill') ?? 0,
      layers: layersChild ? layersChild.slice(1).map(String) : [],
      netOrdinal: getNumberAtom(via, 'net') ?? 0,
    };
  });

  const zones: PcbZone[] = findChildren(root, 'zone').map(zone => ({
    uuid: objectUuid(zone),
    netOrdinal: getNumberAtom(zone, 'net') ?? 0,
    netName: getStringAtom(zone, 'net_name') ?? '',
    layer: getStringAtom(zone, 'layer') ?? '',
  }));

  const outline: BoardOutlineSegment[] = [];
  for (const tag of ['gr_line', 'gr_rect', 'gr_arc', 'gr_circle', 'gr_poly']) {
    for (const g of findChildren(root, tag)) {
      if (getStringAtom(g, 'layer') !== 'Edge.Cuts') continue;
      outline.push({
        uuid: objectUuid(g),
        kind: tag,
        start: findChild(g, 'start') ? xy(findChild(g, 'start')) : undefined,
        end: findChild(g, 'end') ? xy(findChild(g, 'end')) : undefined,
      });
    }
  }

  return {
    version: getNumberAtom(root, 'version') ?? 0,
    generator: getStringAtom(root, 'generator') ?? 'unknown',
    sourcePath: filePath,
    nets,
    footprints,
    tracks,
    vias,
    zones,
    layers,
    outline,
    raw: root,
  };
}
