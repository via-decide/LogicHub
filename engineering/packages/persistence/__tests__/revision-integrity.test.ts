import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../src/repositories/project.repository.js';
import { SqliteRevisionRepository } from '../src/repositories/revision.repository.js';
import { SqliteEngineeringObjectRepository } from '../src/repositories/engineering-object.repository.js';
import { SqliteConstraintRepository } from '../src/repositories/constraint.repository.js';
import { SqliteDecisionRepository } from '../src/repositories/decision.repository.js';
import { SqliteArtifactRepository } from '../src/repositories/artifact.repository.js';
import { computeSnapshotHashes } from '../src/hashing/snapshot-hasher.js';
import { createTestDb, makeProject, makeRevision, makeEngineeringObject, makeConstraint, makeDecision, makeArtifact, sha256 } from './helpers.js';
import type { EngineeringObject, Constraint, Decision, Artifact } from '@logichub-engineering/contracts';

describe('Revision Integrity (Exit Condition)', () => {
  let db: Database.Database;
  let projRepo: SqliteProjectRepository;
  let revRepo: SqliteRevisionRepository;
  let eoRepo: SqliteEngineeringObjectRepository;
  let conRepo: SqliteConstraintRepository;
  let decRepo: SqliteDecisionRepository;
  let artRepo: SqliteArtifactRepository;

  beforeEach(async () => {
    db = createTestDb();
    projRepo = new SqliteProjectRepository(db);
    revRepo = new SqliteRevisionRepository(db);
    eoRepo = new SqliteEngineeringObjectRepository(db);
    conRepo = new SqliteConstraintRepository(db);
    decRepo = new SqliteDecisionRepository(db);
    artRepo = new SqliteArtifactRepository(db);
    await projRepo.create(makeProject());
    await revRepo.create(makeRevision());
  });

  it('stores, restores, and integrity-checks a revision', async () => {
    const eo1 = makeEngineeringObject({ id: 'eo-1', contentHash: sha256('eo-c1'), semanticHash: sha256('eo-s1'), semanticKey: 'component:R1' }) as EngineeringObject;
    const eo2 = makeEngineeringObject({ id: 'eo-2', name: 'C1', contentHash: sha256('eo-c2'), semanticHash: sha256('eo-s2'), semanticKey: 'component:C1' }) as EngineeringObject;
    await eoRepo.createMany([eo1, eo2]);

    const con1 = makeConstraint({ id: 'con-1', name: 'VCC Range' }) as Constraint;
    await conRepo.create(con1);

    const dec1 = makeDecision({ id: 'dec-1' }) as Decision;
    await decRepo.create(dec1);

    const art1 = makeArtifact({ id: 'art-1', sha256: sha256('art-content-1'), storageKey: 'ab/' + sha256('art-content-1') }) as Artifact;
    await artRepo.create(art1);

    const originalHashes = computeSnapshotHashes({
      engineeringObjects: [eo1, eo2],
      constraints: [con1],
      decisions: [dec1],
      bomItems: [],
      artifacts: [art1],
    });

    await revRepo.setSnapshotHashes('rev-1', originalHashes);

    const storedRevision = await revRepo.findById('rev-1');
    expect(storedRevision).not.toBeNull();
    expect(storedRevision!.snapshotHash).toBe(originalHashes.snapshotHash);

    const restoredEOs = await eoRepo.findByRevisionId('rev-1');
    const restoredCons = await conRepo.findByRevisionId('rev-1');
    const restoredDecs = await decRepo.findByRevisionId('rev-1');
    const restoredArts = await artRepo.findByRevisionId('rev-1');

    const recomputedHashes = computeSnapshotHashes({
      engineeringObjects: restoredEOs,
      constraints: restoredCons,
      decisions: restoredDecs,
      bomItems: [],
      artifacts: restoredArts,
    });

    expect(recomputedHashes.snapshotHash).toBe(originalHashes.snapshotHash);
    expect(recomputedHashes.engineeringObjectSnapshotHash).toBe(originalHashes.engineeringObjectSnapshotHash);
    expect(recomputedHashes.constraintSnapshotHash).toBe(originalHashes.constraintSnapshotHash);
    expect(recomputedHashes.decisionSnapshotHash).toBe(originalHashes.decisionSnapshotHash);
    expect(recomputedHashes.bomSnapshotHash).toBe(originalHashes.bomSnapshotHash);
    expect(recomputedHashes.artifactManifestHash).toBe(originalHashes.artifactManifestHash);

    expect(recomputedHashes.snapshotHash).toBe(storedRevision!.snapshotHash);
  });

  it('rejects mutation of a merged revision', async () => {
    await revRepo.updateStatus('rev-1', 'imported');
    await revRepo.updateStatus('rev-1', 'validating');
    await revRepo.updateStatus('rev-1', 'validated');
    await revRepo.updateStatus('rev-1', 'review');
    await revRepo.updateStatus('rev-1', 'merged');

    await expect(revRepo.updateStatus('rev-1', 'draft')).rejects.toThrow(/terminal/i);

    const hashes = {
      snapshotHash: sha256('snap'),
      engineeringObjectSnapshotHash: sha256('eo'),
      constraintSnapshotHash: sha256('con'),
      decisionSnapshotHash: sha256('dec'),
      bomSnapshotHash: sha256('bom'),
      artifactManifestHash: sha256('art'),
    };
    await expect(revRepo.setSnapshotHashes('rev-1', hashes)).rejects.toThrow(/cannot set snapshot hashes/i);
  });

  it('rejects mutation of a rejected revision', async () => {
    await revRepo.updateStatus('rev-1', 'rejected');
    await expect(revRepo.updateStatus('rev-1', 'draft')).rejects.toThrow(/terminal/i);
  });

  it('rejects mutation of a failed revision', async () => {
    await revRepo.updateStatus('rev-1', 'failed');
    await expect(revRepo.updateStatus('rev-1', 'draft')).rejects.toThrow(/terminal/i);
  });

  it('allows setting hashes on imported revision', async () => {
    await revRepo.updateStatus('rev-1', 'imported');
    const hashes = {
      snapshotHash: sha256('snap'),
      engineeringObjectSnapshotHash: sha256('eo'),
      constraintSnapshotHash: sha256('con'),
      decisionSnapshotHash: sha256('dec'),
      bomSnapshotHash: sha256('bom'),
      artifactManifestHash: sha256('art'),
    };
    await revRepo.setSnapshotHashes('rev-1', hashes);
    const found = await revRepo.findById('rev-1');
    expect(found!.snapshotHash).toBe(hashes.snapshotHash);
  });
});
