import { describe, it, expect } from 'vitest';
import { computeSnapshotHashes } from '../src/hashing/snapshot-hasher.js';
import { makeEngineeringObject, makeConstraint, makeDecision, makeArtifact, sha256 } from './helpers.js';
import type { EngineeringObject, Constraint, Decision, Artifact } from '@logichub-engineering/contracts';

describe('computeSnapshotHashes', () => {
  const emptyInput = {
    engineeringObjects: [] as EngineeringObject[],
    constraints: [] as Constraint[],
    decisions: [] as Decision[],
    bomItems: [] as EngineeringObject[],
    artifacts: [] as Artifact[],
  };

  it('produces deterministic hashes', () => {
    const obj = makeEngineeringObject() as EngineeringObject;
    const a = computeSnapshotHashes({ ...emptyInput, engineeringObjects: [obj] });
    const b = computeSnapshotHashes({ ...emptyInput, engineeringObjects: [obj] });
    expect(a).toEqual(b);
  });

  it('is order-independent for engineering objects', () => {
    const obj1 = makeEngineeringObject({ id: 'eo-1', contentHash: sha256('a'), semanticHash: sha256('sa') }) as EngineeringObject;
    const obj2 = makeEngineeringObject({ id: 'eo-2', contentHash: sha256('b'), semanticHash: sha256('sb'), semanticKey: 'component:C1' }) as EngineeringObject;
    const a = computeSnapshotHashes({ ...emptyInput, engineeringObjects: [obj1, obj2] });
    const b = computeSnapshotHashes({ ...emptyInput, engineeringObjects: [obj2, obj1] });
    expect(a.engineeringObjectSnapshotHash).toBe(b.engineeringObjectSnapshotHash);
    expect(a.snapshotHash).toBe(b.snapshotHash);
  });

  it('is order-independent for constraints', () => {
    const c1 = makeConstraint({ id: 'con-1', name: 'A' }) as Constraint;
    const c2 = makeConstraint({ id: 'con-2', name: 'B' }) as Constraint;
    const a = computeSnapshotHashes({ ...emptyInput, constraints: [c1, c2] });
    const b = computeSnapshotHashes({ ...emptyInput, constraints: [c2, c1] });
    expect(a.constraintSnapshotHash).toBe(b.constraintSnapshotHash);
  });

  it('is order-independent for decisions', () => {
    const d1 = makeDecision({ id: 'dec-1', question: 'Q1' }) as Decision;
    const d2 = makeDecision({ id: 'dec-2', question: 'Q2' }) as Decision;
    const a = computeSnapshotHashes({ ...emptyInput, decisions: [d1, d2] });
    const b = computeSnapshotHashes({ ...emptyInput, decisions: [d2, d1] });
    expect(a.decisionSnapshotHash).toBe(b.decisionSnapshotHash);
  });

  it('produces consistent hashes for empty arrays', () => {
    const a = computeSnapshotHashes(emptyInput);
    const b = computeSnapshotHashes(emptyInput);
    expect(a).toEqual(b);
    expect(a.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.engineeringObjectSnapshotHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes snapshot hash when sub-content changes', () => {
    const obj1 = makeEngineeringObject({ contentHash: sha256('version-1') }) as EngineeringObject;
    const obj2 = makeEngineeringObject({ contentHash: sha256('version-2') }) as EngineeringObject;
    const a = computeSnapshotHashes({ ...emptyInput, engineeringObjects: [obj1] });
    const b = computeSnapshotHashes({ ...emptyInput, engineeringObjects: [obj2] });
    expect(a.engineeringObjectSnapshotHash).not.toBe(b.engineeringObjectSnapshotHash);
    expect(a.snapshotHash).not.toBe(b.snapshotHash);
  });

  it('each sub-hash is independent', () => {
    const obj = makeEngineeringObject() as EngineeringObject;
    const con = makeConstraint() as Constraint;
    const withObj = computeSnapshotHashes({ ...emptyInput, engineeringObjects: [obj] });
    const withCon = computeSnapshotHashes({ ...emptyInput, constraints: [con] });
    expect(withObj.engineeringObjectSnapshotHash).not.toBe(withCon.engineeringObjectSnapshotHash);
    expect(withObj.constraintSnapshotHash).toBe(computeSnapshotHashes(emptyInput).constraintSnapshotHash);
  });

  it('uses artifact sha256 for artifact manifest hash', () => {
    const art1 = makeArtifact({ sha256: sha256('file-a') }) as Artifact;
    const art2 = makeArtifact({ id: 'art-2', sha256: sha256('file-b'), storageKey: 'x' }) as Artifact;
    const a = computeSnapshotHashes({ ...emptyInput, artifacts: [art1, art2] });
    const b = computeSnapshotHashes({ ...emptyInput, artifacts: [art2, art1] });
    expect(a.artifactManifestHash).toBe(b.artifactManifestHash);
  });

  it('uses bom item contentHash for bom snapshot', () => {
    const bom1 = makeEngineeringObject({ id: 'bom-1', objectType: 'bom_item', contentHash: sha256('bom-a'), semanticKey: 'bom:1', semanticHash: sha256('bsem1') }) as EngineeringObject;
    const bom2 = makeEngineeringObject({ id: 'bom-2', objectType: 'bom_item', contentHash: sha256('bom-b'), semanticKey: 'bom:2', semanticHash: sha256('bsem2') }) as EngineeringObject;
    const a = computeSnapshotHashes({ ...emptyInput, bomItems: [bom1, bom2] });
    const b = computeSnapshotHashes({ ...emptyInput, bomItems: [bom2, bom1] });
    expect(a.bomSnapshotHash).toBe(b.bomSnapshotHash);
  });
});
