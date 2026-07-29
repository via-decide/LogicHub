import type { DeltaRecord, ReplayOperation } from './types.js';
import type { FingerprintDescriptor } from '../types.js';
import { sha256Hex } from '../util/hash.js';
import { jcsCanonicalize } from '../util/jcs.js';
import { sortByKeys } from '../util/deterministic.js';

export interface ReplayDocument {
  schemaVersion: string;
  baseDescriptorHash: string;
  targetDescriptorHash: string;
  operations: ReplayOperation[];
  operationCount: number;
  replayHash: string;
}

export function buildReplayDocument(
  deltas: DeltaRecord[],
  base: FingerprintDescriptor,
  proposed: FingerprintDescriptor,
): ReplayDocument {
  const ops = deltas.map(d => d.replayOperation);

  const removes = ops.filter(o => o.operation === 'remove');
  const moves = ops.filter(o => o.operation === 'move');
  const replaces = ops.filter(o => o.operation === 'replace');
  const adds = ops.filter(o => o.operation === 'add');

  const ordered = [
    ...sortByKeys(removes, [o => o.objectId]),
    ...sortByKeys(moves, [o => o.objectId]),
    ...sortByKeys(replaces, [o => o.objectId]),
    ...sortByKeys(adds, [o => o.objectId]),
  ];

  const replayHash = sha256Hex(jcsCanonicalize(ordered));

  return {
    schemaVersion: '0.1.0',
    baseDescriptorHash: base.descriptorHash,
    targetDescriptorHash: proposed.descriptorHash,
    operations: ordered,
    operationCount: ordered.length,
    replayHash,
  };
}

export interface CapabilityState {
  objects: Map<string, { semanticHash: string }>;
}

export function materializeCapabilityState(fingerprint: FingerprintDescriptor): CapabilityState {
  const objects = new Map<string, { semanticHash: string }>();

  for (const sw of fingerprint.softwareSurface) {
    for (const exp of sw.exportedSymbols) {
      objects.set(exp.semanticId, { semanticHash: exp.bodyHash });
    }
  }

  if (fingerprint.schematicSurface) {
    for (const sym of fingerprint.schematicSurface.symbols) {
      objects.set(sym.semanticId, { semanticHash: sym.semanticHash });
    }
  }

  if (fingerprint.pcbSurface) {
    for (const fp of fingerprint.pcbSurface.footprints) {
      objects.set(fp.semanticId, { semanticHash: fp.footprint });
    }
  }

  if (fingerprint.bomSurface) {
    for (const g of fingerprint.bomSurface.groups) {
      const key = `bom::${g.value}|${g.footprint}`;
      objects.set(key, { semanticHash: g.semanticHash });
    }
  }

  if (fingerprint.constraintSurface) {
    for (const c of fingerprint.constraintSurface.constraints) {
      objects.set(`constraint::${c.id}`, { semanticHash: c.semanticHash });
    }
  }

  if (fingerprint.decisionSurface) {
    for (const d of fingerprint.decisionSurface.decisions) {
      objects.set(`decision::${d.id}`, { semanticHash: d.selectedOptionHash ?? '' });
    }
  }

  return { objects };
}

export function applyReplay(
  baseState: CapabilityState,
  operations: ReplayOperation[],
): { state: CapabilityState; errors: string[] } {
  const state = new Map(baseState.objects);
  const errors: string[] = [];

  for (const op of operations) {
    switch (op.operation) {
      case 'remove': {
        if (!state.has(op.objectId)) {
          errors.push(`Remove: object ${op.objectId} not found in state`);
          continue;
        }
        if (op.expectedOldHash && state.get(op.objectId)?.semanticHash !== op.expectedOldHash) {
          errors.push(`Remove: hash mismatch for ${op.objectId}`);
        }
        state.delete(op.objectId);
        break;
      }
      case 'add': {
        if (op.expectedAbsent && state.has(op.objectId)) {
          errors.push(`Add: object ${op.objectId} already exists`);
        }
        if (op.newObject) {
          state.set(op.objectId, { semanticHash: op.newObject.semanticHash });
        }
        break;
      }
      case 'replace': {
        if (op.expectedOldHash && state.has(op.objectId)) {
          if (state.get(op.objectId)?.semanticHash !== op.expectedOldHash) {
            errors.push(`Replace: hash mismatch for ${op.objectId}`);
          }
        }
        if (op.newObject) {
          state.set(op.objectId, { semanticHash: op.newObject.semanticHash });
        }
        break;
      }
      case 'move': {
        if (op.oldObjectId && op.newObjectId) {
          const existing = state.get(op.oldObjectId);
          if (!existing) {
            errors.push(`Move: source ${op.oldObjectId} not found`);
            continue;
          }
          state.delete(op.oldObjectId);
          state.set(op.newObjectId, existing);
        }
        break;
      }
    }
  }

  return { state: { objects: state }, errors };
}

export function verifyReplay(
  baseFingerprint: FingerprintDescriptor,
  proposedFingerprint: FingerprintDescriptor,
  operations: ReplayOperation[],
): { verified: boolean; errors: string[] } {
  const baseState = materializeCapabilityState(baseFingerprint);
  const { state: replayedState, errors } = applyReplay(baseState, operations);
  const targetState = materializeCapabilityState(proposedFingerprint);

  const replayedHash = sha256Hex(jcsCanonicalize(
    Object.fromEntries([...replayedState.objects.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)),
  ));
  const targetHash = sha256Hex(jcsCanonicalize(
    Object.fromEntries([...targetState.objects.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)),
  ));

  if (replayedHash !== targetHash) {
    errors.push(`Replay state hash ${replayedHash} does not match target ${targetHash}`);
  }

  return { verified: errors.length === 0, errors };
}
