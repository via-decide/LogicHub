import type { FingerprintDescriptor, SoftwareFileSurface, SymbolSummary, BomGroupSummary, ConstraintSummaryEntry } from '../types.js';
import type { DeltaRecord, DeltaType, DeltaDomain, ReplayOperation } from './types.js';
import type { GraphMapResult } from '../graphmap/graphmap.js';
import { detectFileMoves, detectSymbolMoves } from './move-detector.js';
import { sha256Hex } from '../util/hash.js';
import { jcsCanonicalize } from '../util/jcs.js';
import { sortByKeys, sortStrings } from '../util/deterministic.js';

export function generateDeltas(
  base: FingerprintDescriptor,
  proposed: FingerprintDescriptor,
  baseGraph: GraphMapResult | null,
  proposedGraph: GraphMapResult | null,
): DeltaRecord[] {
  const deltas: DeltaRecord[] = [];

  deltas.push(...generateSoftwareDeltas(base, proposed));
  deltas.push(...generateSchematicDeltas(base, proposed));
  deltas.push(...generatePcbDeltas(base, proposed));
  deltas.push(...generateBomDeltas(base, proposed));
  deltas.push(...generateConstraintDeltas(base, proposed));
  deltas.push(...generateDecisionDeltas(base, proposed));
  if (baseGraph && proposedGraph) {
    deltas.push(...generateGraphDeltas(baseGraph, proposedGraph));
  }

  return sortByKeys(deltas, [
    d => d.domain,
    d => d.deltaType,
    d => d.oldSemanticId ?? '',
    d => d.newSemanticId ?? '',
    d => d.recordId,
  ]);
}

function generateSoftwareDeltas(
  base: FingerprintDescriptor, proposed: FingerprintDescriptor,
): DeltaRecord[] {
  const deltas: DeltaRecord[] = [];
  const baseMap = new Map(base.softwareSurface.map(s => [s.path, s]));
  const proposedMap = new Map(proposed.softwareSurface.map(s => [s.path, s]));

  const fileMoves = detectFileMoves(base.sourceInventory, proposed.sourceInventory);
  const moveMap = new Map(fileMoves.map(m => [m.basePath, m.proposedPath]));
  const reverseMoveMap = new Map(fileMoves.map(m => [m.proposedPath, m.basePath]));

  for (const [path, baseSurface] of baseMap) {
    if (moveMap.has(path)) continue;
    if (!proposedMap.has(path)) {
      for (const exp of baseSurface.exportedSymbols) {
        deltas.push(makeDelta('API_REMOVED', 'software', exp.semanticId, null, exp.bodyHash, null, {
          operation: 'remove', objectId: exp.semanticId, expectedOldHash: exp.bodyHash,
        }, [path]));
      }
    }
  }

  for (const [path, proposedSurface] of proposedMap) {
    if (reverseMoveMap.has(path)) continue;
    if (!baseMap.has(path)) {
      for (const exp of proposedSurface.exportedSymbols) {
        deltas.push(makeDelta('API_ADDED', 'software', null, exp.semanticId, null, exp.bodyHash, {
          operation: 'add', objectId: exp.semanticId, expectedOldHash: null, expectedAbsent: true,
          newObject: { semanticId: exp.semanticId, semanticHash: exp.bodyHash },
        }, [path]));
      }
    }
  }

  for (const [path, baseSurface] of baseMap) {
    const proposedSurface = proposedMap.get(path);
    if (!proposedSurface) continue;

    const allBaseExports = baseSurface.exportedSymbols;
    const allProposedExports = proposedSurface.exportedSymbols;

    const moves = detectSymbolMoves(allBaseExports, allProposedExports);
    const movedBase = new Set(moves.map(m => m.baseSemanticId));
    const movedProposed = new Set(moves.map(m => m.proposedSemanticId));

    for (const move of moves) {
      deltas.push(makeDelta(
        'CAPABILITY_MOVED', 'software', move.baseSemanticId, move.proposedSemanticId,
        null, null,
        { operation: 'move', objectId: move.baseSemanticId, expectedOldHash: null, oldObjectId: move.baseSemanticId, newObjectId: move.proposedSemanticId },
        [path],
      ));
    }

    const baseExportMap = new Map(allBaseExports.map(e => [e.name, e]));
    const proposedExportMap = new Map(allProposedExports.map(e => [e.name, e]));

    for (const [name, baseExp] of baseExportMap) {
      if (movedBase.has(baseExp.semanticId)) continue;
      const proposedExp = proposedExportMap.get(name);
      if (!proposedExp) {
        deltas.push(makeDelta('API_REMOVED', 'software', baseExp.semanticId, null, baseExp.bodyHash, null, {
          operation: 'remove', objectId: baseExp.semanticId, expectedOldHash: baseExp.bodyHash,
        }, [path]));
        continue;
      }
      if (movedProposed.has(proposedExp.semanticId)) continue;

      if (baseExp.normalizedSignature !== proposedExp.normalizedSignature) {
        deltas.push(makeDelta(
          'SIGNATURE_CHANGED', 'software', baseExp.semanticId, proposedExp.semanticId,
          baseExp.normalizedSignature, proposedExp.normalizedSignature,
          { operation: 'replace', objectId: baseExp.semanticId, expectedOldHash: baseExp.bodyHash,
            newObject: { semanticId: proposedExp.semanticId, semanticHash: proposedExp.bodyHash } },
          [path],
        ));
      } else if (baseExp.bodyHash !== proposedExp.bodyHash) {
        deltas.push(makeDelta(
          'IMPLEMENTATION_CHANGED', 'software', baseExp.semanticId, proposedExp.semanticId,
          baseExp.bodyHash, proposedExp.bodyHash,
          { operation: 'replace', objectId: baseExp.semanticId, expectedOldHash: baseExp.bodyHash,
            newObject: { semanticId: proposedExp.semanticId, semanticHash: proposedExp.bodyHash } },
          [path],
        ));
      }
    }

    for (const [name, proposedExp] of proposedExportMap) {
      if (movedProposed.has(proposedExp.semanticId)) continue;
      if (!baseExportMap.has(name)) {
        deltas.push(makeDelta('API_ADDED', 'software', null, proposedExp.semanticId, null, proposedExp.bodyHash, {
          operation: 'add', objectId: proposedExp.semanticId, expectedOldHash: null, expectedAbsent: true,
          newObject: { semanticId: proposedExp.semanticId, semanticHash: proposedExp.bodyHash },
        }, [path]));
      }
    }

    const baseImportSources = new Set(baseSurface.imports.map(i => i.source));
    const proposedImportSources = new Set(proposedSurface.imports.map(i => i.source));

    for (const src of proposedImportSources) {
      if (!baseImportSources.has(src)) {
        deltas.push(makeDelta('DEPENDENCY_ADDED', 'software', null, `import::${path}::${src}`, null, null,
          { operation: 'add', objectId: `import::${path}::${src}`, expectedOldHash: null, expectedAbsent: true },
          [path]));
      }
    }
    for (const src of baseImportSources) {
      if (!proposedImportSources.has(src)) {
        deltas.push(makeDelta('DEPENDENCY_REMOVED', 'software', `import::${path}::${src}`, null, null, null,
          { operation: 'remove', objectId: `import::${path}::${src}`, expectedOldHash: null },
          [path]));
      }
    }
  }

  for (const move of fileMoves) {
    const baseSurface = baseMap.get(move.basePath);
    const proposedSurface = proposedMap.get(move.proposedPath);
    if (baseSurface && proposedSurface) {
      for (const exp of baseSurface.exportedSymbols) {
        deltas.push(makeDelta(
          'CAPABILITY_MOVED', 'software',
          exp.semanticId,
          exp.semanticId.replace(move.basePath, move.proposedPath),
          null, null,
          { operation: 'move', objectId: exp.semanticId, expectedOldHash: exp.bodyHash,
            oldObjectId: exp.semanticId,
            newObjectId: exp.semanticId.replace(move.basePath, move.proposedPath) },
          [move.basePath, move.proposedPath],
        ));
      }
    }
  }

  return deltas;
}

function generateSchematicDeltas(
  base: FingerprintDescriptor, proposed: FingerprintDescriptor,
): DeltaRecord[] {
  const deltas: DeltaRecord[] = [];
  if (!base.schematicSurface && !proposed.schematicSurface) return deltas;

  const baseSymbols = new Map((base.schematicSurface?.symbols ?? []).map(s => [s.reference, s]));
  const proposedSymbols = new Map((proposed.schematicSurface?.symbols ?? []).map(s => [s.reference, s]));

  for (const [ref, baseSym] of baseSymbols) {
    const proposedSym = proposedSymbols.get(ref);
    if (!proposedSym) {
      deltas.push(makeDelta('SYMBOL_REMOVED', 'schematic', baseSym.semanticId, null,
        baseSym.semanticHash, null,
        { operation: 'remove', objectId: baseSym.semanticId, expectedOldHash: baseSym.semanticHash },
        []));
      continue;
    }
    if (baseSym.value !== proposedSym.value) {
      deltas.push(makeDelta('SYMBOL_VALUE_CHANGED', 'schematic', baseSym.semanticId, proposedSym.semanticId,
        baseSym.value, proposedSym.value,
        { operation: 'replace', objectId: baseSym.semanticId, expectedOldHash: baseSym.semanticHash,
          newObject: { semanticId: proposedSym.semanticId, semanticHash: proposedSym.semanticHash } },
        []));
    }
    if (baseSym.footprint !== proposedSym.footprint) {
      deltas.push(makeDelta('SYMBOL_FOOTPRINT_CHANGED', 'schematic', baseSym.semanticId, proposedSym.semanticId,
        baseSym.footprint, proposedSym.footprint,
        { operation: 'replace', objectId: baseSym.semanticId, expectedOldHash: baseSym.semanticHash,
          newObject: { semanticId: proposedSym.semanticId, semanticHash: proposedSym.semanticHash } },
        []));
    }
  }

  for (const [ref, proposedSym] of proposedSymbols) {
    if (!baseSymbols.has(ref)) {
      deltas.push(makeDelta('SYMBOL_ADDED', 'schematic', null, proposedSym.semanticId,
        null, proposedSym.semanticHash,
        { operation: 'add', objectId: proposedSym.semanticId, expectedOldHash: null, expectedAbsent: true,
          newObject: { semanticId: proposedSym.semanticId, semanticHash: proposedSym.semanticHash } },
        []));
    }
  }

  const baseNets = new Set(base.schematicSurface?.nets.map(n => n.name) ?? []);
  const proposedNets = new Set(proposed.schematicSurface?.nets.map(n => n.name) ?? []);
  for (const net of proposedNets) {
    if (!baseNets.has(net)) {
      deltas.push(makeDelta('NET_ADDED', 'schematic', null, `net::${net}`, null, null,
        { operation: 'add', objectId: `net::${net}`, expectedOldHash: null, expectedAbsent: true }, []));
    }
  }
  for (const net of baseNets) {
    if (!proposedNets.has(net)) {
      deltas.push(makeDelta('NET_REMOVED', 'schematic', `net::${net}`, null, null, null,
        { operation: 'remove', objectId: `net::${net}`, expectedOldHash: null }, []));
    }
  }

  return deltas;
}

function generatePcbDeltas(
  base: FingerprintDescriptor, proposed: FingerprintDescriptor,
): DeltaRecord[] {
  const deltas: DeltaRecord[] = [];
  if (!base.pcbSurface && !proposed.pcbSurface) return deltas;

  const baseFp = new Map((base.pcbSurface?.footprints ?? []).map(f => [f.reference, f]));
  const proposedFp = new Map((proposed.pcbSurface?.footprints ?? []).map(f => [f.reference, f]));

  for (const [ref, baseFoot] of baseFp) {
    if (!proposedFp.has(ref)) {
      deltas.push(makeDelta('FOOTPRINT_REMOVED', 'pcb', baseFoot.semanticId, null, null, null,
        { operation: 'remove', objectId: baseFoot.semanticId, expectedOldHash: null }, []));
    } else {
      const proposedFoot = proposedFp.get(ref)!;
      if (baseFoot.footprint !== proposedFoot.footprint || baseFoot.layer !== proposedFoot.layer) {
        deltas.push(makeDelta('FOOTPRINT_CHANGED', 'pcb', baseFoot.semanticId, proposedFoot.semanticId,
          baseFoot.footprint, proposedFoot.footprint,
          { operation: 'replace', objectId: baseFoot.semanticId, expectedOldHash: null,
            newObject: { semanticId: proposedFoot.semanticId, semanticHash: proposedFoot.footprint } },
          []));
      }
    }
  }

  for (const [ref, proposedFoot] of proposedFp) {
    if (!baseFp.has(ref)) {
      deltas.push(makeDelta('FOOTPRINT_ADDED', 'pcb', null, proposedFoot.semanticId, null, null,
        { operation: 'add', objectId: proposedFoot.semanticId, expectedOldHash: null, expectedAbsent: true }, []));
    }
  }

  if (base.pcbSurface?.boardOutline?.semanticHash !== proposed.pcbSurface?.boardOutline?.semanticHash) {
    if (base.pcbSurface?.boardOutline && proposed.pcbSurface?.boardOutline) {
      deltas.push(makeDelta('BOARD_OUTLINE_CHANGED', 'pcb', 'pcb::board_outline', 'pcb::board_outline',
        base.pcbSurface.boardOutline.semanticHash, proposed.pcbSurface.boardOutline.semanticHash,
        { operation: 'replace', objectId: 'pcb::board_outline',
          expectedOldHash: base.pcbSurface.boardOutline.semanticHash }, []));
    }
  }

  return deltas;
}

function generateBomDeltas(
  base: FingerprintDescriptor, proposed: FingerprintDescriptor,
): DeltaRecord[] {
  const deltas: DeltaRecord[] = [];
  if (!base.bomSurface && !proposed.bomSurface) return deltas;

  const baseGroups = new Map((base.bomSurface?.groups ?? []).map(g => [bomKey(g), g]));
  const proposedGroups = new Map((proposed.bomSurface?.groups ?? []).map(g => [bomKey(g), g]));

  for (const [key, baseGroup] of baseGroups) {
    if (!proposedGroups.has(key)) {
      deltas.push(makeDelta('BOM_ITEM_REMOVED', 'bom', `bom::${key}`, null,
        baseGroup.semanticHash, null,
        { operation: 'remove', objectId: `bom::${key}`, expectedOldHash: baseGroup.semanticHash }, []));
    } else {
      const proposedGroup = proposedGroups.get(key)!;
      if (baseGroup.quantity !== proposedGroup.quantity) {
        deltas.push(makeDelta('QUANTITY_CHANGED', 'bom', `bom::${key}`, `bom::${key}`,
          String(baseGroup.quantity), String(proposedGroup.quantity),
          { operation: 'replace', objectId: `bom::${key}`, expectedOldHash: baseGroup.semanticHash,
            newObject: { semanticId: `bom::${key}`, semanticHash: proposedGroup.semanticHash } }, []));
      }
      if (baseGroup.mpn !== proposedGroup.mpn) {
        deltas.push(makeDelta('MPN_CHANGED', 'bom', `bom::${key}`, `bom::${key}`,
          baseGroup.mpn, proposedGroup.mpn,
          { operation: 'replace', objectId: `bom::${key}`, expectedOldHash: baseGroup.semanticHash,
            newObject: { semanticId: `bom::${key}`, semanticHash: proposedGroup.semanticHash } }, []));
      }
    }
  }

  for (const [key, proposedGroup] of proposedGroups) {
    if (!baseGroups.has(key)) {
      deltas.push(makeDelta('BOM_ITEM_ADDED', 'bom', null, `bom::${key}`,
        null, proposedGroup.semanticHash,
        { operation: 'add', objectId: `bom::${key}`, expectedOldHash: null, expectedAbsent: true,
          newObject: { semanticId: `bom::${key}`, semanticHash: proposedGroup.semanticHash } }, []));
    }
  }

  return deltas;
}

function generateConstraintDeltas(
  base: FingerprintDescriptor, proposed: FingerprintDescriptor,
): DeltaRecord[] {
  const deltas: DeltaRecord[] = [];
  const baseMap = new Map((base.constraintSurface?.constraints ?? []).map(c => [c.id, c]));
  const proposedMap = new Map((proposed.constraintSurface?.constraints ?? []).map(c => [c.id, c]));

  for (const [id, baseC] of baseMap) {
    if (!proposedMap.has(id)) {
      deltas.push(makeDelta('CONSTRAINT_REMOVED', 'constraint', `constraint::${id}`, null,
        baseC.semanticHash, null,
        { operation: 'remove', objectId: `constraint::${id}`, expectedOldHash: baseC.semanticHash }, []));
    } else {
      const proposedC = proposedMap.get(id)!;
      if (baseC.semanticHash !== proposedC.semanticHash) {
        deltas.push(makeDelta('CONSTRAINT_CHANGED', 'constraint', `constraint::${id}`, `constraint::${id}`,
          baseC.semanticHash, proposedC.semanticHash,
          { operation: 'replace', objectId: `constraint::${id}`, expectedOldHash: baseC.semanticHash,
            newObject: { semanticId: `constraint::${id}`, semanticHash: proposedC.semanticHash } }, []));
      }
    }
  }

  for (const [id, proposedC] of proposedMap) {
    if (!baseMap.has(id)) {
      deltas.push(makeDelta('CONSTRAINT_ADDED', 'constraint', null, `constraint::${id}`,
        null, proposedC.semanticHash,
        { operation: 'add', objectId: `constraint::${id}`, expectedOldHash: null, expectedAbsent: true,
          newObject: { semanticId: `constraint::${id}`, semanticHash: proposedC.semanticHash } }, []));
    }
  }

  return deltas;
}

function generateDecisionDeltas(
  base: FingerprintDescriptor, proposed: FingerprintDescriptor,
): DeltaRecord[] {
  const deltas: DeltaRecord[] = [];
  const baseMap = new Map((base.decisionSurface?.decisions ?? []).map(d => [d.id, d]));
  const proposedMap = new Map((proposed.decisionSurface?.decisions ?? []).map(d => [d.id, d]));

  for (const [id, baseD] of baseMap) {
    if (!proposedMap.has(id)) continue;
    const proposedD = proposedMap.get(id)!;
    if (baseD.status !== proposedD.status && proposedD.status === 'superseded') {
      deltas.push(makeDelta('DECISION_SUPERSEDED', 'decision', `decision::${id}`, `decision::${id}`,
        baseD.status, proposedD.status,
        { operation: 'replace', objectId: `decision::${id}`, expectedOldHash: baseD.selectedOptionHash }, []));
    }
  }

  for (const [id] of proposedMap) {
    if (!baseMap.has(id)) {
      deltas.push(makeDelta('DECISION_ADDED', 'decision', null, `decision::${id}`, null, null,
        { operation: 'add', objectId: `decision::${id}`, expectedOldHash: null, expectedAbsent: true }, []));
    }
  }

  return deltas;
}

function generateGraphDeltas(
  baseGraph: GraphMapResult, proposedGraph: GraphMapResult,
): DeltaRecord[] {
  const deltas: DeltaRecord[] = [];
  const baseEdgeIds = new Set(baseGraph.edges.map(e => e.edgeId));
  const proposedEdgeIds = new Set(proposedGraph.edges.map(e => e.edgeId));

  for (const edge of proposedGraph.edges) {
    if (!baseEdgeIds.has(edge.edgeId)) {
      deltas.push(makeDelta('RELATION_ADDED', 'graph', null, edge.edgeId, null, null,
        { operation: 'add', objectId: edge.edgeId, expectedOldHash: null, expectedAbsent: true },
        []));
    }
  }

  for (const edge of baseGraph.edges) {
    if (!proposedEdgeIds.has(edge.edgeId)) {
      deltas.push(makeDelta('RELATION_REMOVED', 'graph', edge.edgeId, null, null, null,
        { operation: 'remove', objectId: edge.edgeId, expectedOldHash: null },
        []));
    }
  }

  return deltas;
}

function bomKey(g: BomGroupSummary): string {
  return `${g.value}|${g.footprint}`;
}

function makeDelta(
  deltaType: DeltaType, domain: DeltaDomain,
  oldSemanticId: string | null, newSemanticId: string | null,
  oldValue: string | null, newValue: string | null,
  replayOp: ReplayOperation,
  evidencePaths: string[],
): DeltaRecord {
  const recordId = sha256Hex(jcsCanonicalize({
    deltaType, domain, oldSemanticId, newSemanticId,
  }));

  return {
    schemaVersion: '0.1.0',
    deltaType,
    domain,
    recordId,
    oldSemanticId,
    newSemanticId,
    oldSemanticHash: oldValue,
    newSemanticHash: newValue,
    oldNormalizedValue: oldValue,
    newNormalizedValue: newValue,
    affectedNodeIds: [oldSemanticId, newSemanticId].filter((id): id is string => id !== null),
    supportingEdgeIds: [],
    evidenceSourcePaths: sortStrings(evidencePaths),
    classificationBasis: 'deterministic_parser',
    replayOperation: replayOp,
    reviewDomains: inferDomainReview(domain),
    validationImplications: [],
  };
}

function inferDomainReview(domain: DeltaDomain): string[] {
  const mapping: Record<DeltaDomain, string[]> = {
    software: ['software'],
    firmware: ['firmware'],
    schematic: ['electrical'],
    pcb: ['pcb'],
    bom: ['supply_chain'],
    constraint: ['project_policy'],
    decision: ['project_policy'],
    validation: ['validation'],
    graph: [],
    cross_domain: [],
  };
  return mapping[domain] ?? [];
}
