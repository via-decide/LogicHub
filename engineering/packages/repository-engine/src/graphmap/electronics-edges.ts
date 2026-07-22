import type { GraphEdge } from './types.js';
import type { SchematicSurface, PcbSurface, BomSurface } from '../types.js';
import { sha256Hex } from '../util/hash.js';
import { jcsCanonicalize } from '../util/jcs.js';

export function generateElectronicsEdges(
  schematic: SchematicSurface | null,
  pcb: PcbSurface | null,
  bom: BomSurface | null,
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  if (schematic) {
    for (const sheet of schematic.sheets) {
      for (const symbol of schematic.symbols) {
        edges.push(makeEdge(
          `schematic::${sheet.name}`, 'CONTAINS', symbol.semanticId,
          'structural', 'exact_semantic_key',
          { sourcePath: sheet.path, semanticLocator: `symbol::${symbol.reference}` },
        ));
      }
    }

    for (const net of schematic.nets) {
      for (const pin of net.connectedPins) {
        edges.push(makeEdge(
          `schematic::net::${net.name}`, 'CONNECTS_TO', pin,
          'structural', 'exact_semantic_key',
          { sourcePath: 'schematic', semanticLocator: `net::${net.name}::pin::${pin}` },
        ));
      }
    }
  }

  if (pcb) {
    for (const fp of pcb.footprints) {
      if (schematic) {
        const symMatch = schematic.symbols.find(s => s.reference === fp.reference);
        if (symMatch) {
          edges.push(makeEdge(
            symMatch.semanticId, 'REALIZED_BY', fp.semanticId,
            'structural', 'exact_reference_designator',
            { sourcePath: 'pcb', semanticLocator: `footprint::${fp.reference}` },
          ));
        }
      }

      for (const pad of pcb.pads.filter(p => p.footprintRef === fp.reference)) {
        edges.push(makeEdge(
          fp.semanticId, 'HAS_PAD', pad.semanticId,
          'structural', 'exact_semantic_key',
          { sourcePath: 'pcb', semanticLocator: `pad::${pad.footprintRef}.${pad.padNumber}` },
        ));

        if (pad.net) {
          edges.push(makeEdge(
            pad.semanticId, 'ASSIGNED_TO_NET', `pcb::net::${pad.net}`,
            'structural', 'exact_semantic_key',
            { sourcePath: 'pcb', semanticLocator: `pad_net::${pad.footprintRef}.${pad.padNumber}::${pad.net}` },
          ));
        }
      }
    }

    for (const tp of pcb.testPoints) {
      const fpMatch = pcb.footprints.find(f => f.reference === tp);
      if (fpMatch) {
        const pads = pcb.pads.filter(p => p.footprintRef === tp);
        for (const pad of pads) {
          if (pad.net) {
            edges.push(makeEdge(
              `pcb::${tp}`, 'TEST_POINT_FOR', `pcb::net::${pad.net}`,
              'structural', 'exact_semantic_key',
              { sourcePath: 'pcb', semanticLocator: `test_point::${tp}::${pad.net}` },
            ));
          }
        }
      }
    }
  }

  if (bom && schematic) {
    for (const group of bom.groups) {
      const bomId = group.mpn
        ? `bom::MPN::${group.mpn}`
        : `bom::${group.value}|${group.footprint}`;

      for (const ref of group.referenceGroup) {
        const symMatch = schematic.symbols.find(s => s.reference === ref);
        if (symMatch) {
          edges.push(makeEdge(
            bomId, 'SOURCED_AS', symMatch.semanticId,
            'structural', 'exact_reference_designator',
            { sourcePath: 'bom', semanticLocator: `bom::${ref}` },
          ));
        }
      }
    }
  }

  return edges;
}

function makeEdge(
  from: string, type: GraphEdge['type'], to: string,
  resolution: GraphEdge['resolution'],
  confidenceBasis: GraphEdge['confidenceBasis'],
  evidence: GraphEdge['evidence'],
): GraphEdge {
  const edgeId = sha256Hex(jcsCanonicalize({
    from, type, to, resolution,
    normalizedEvidenceIdentity: evidence.semanticLocator,
  }));

  return {
    edgeId,
    from,
    type,
    to,
    resolution,
    confidenceBasis,
    domain: 'electronics',
    evidence,
  };
}
