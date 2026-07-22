import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../src/repositories/project.repository.js';
import { SqliteRevisionRepository } from '../src/repositories/revision.repository.js';
import { createTestDb, makeProject, makeRevision, sha256 } from './helpers.js';

describe('SqliteRevisionRepository', () => {
  let db: Database.Database;
  let projRepo: SqliteProjectRepository;
  let repo: SqliteRevisionRepository;

  beforeEach(async () => {
    db = createTestDb();
    projRepo = new SqliteProjectRepository(db);
    repo = new SqliteRevisionRepository(db);
    await projRepo.create(makeProject());
  });

  it('creates and finds by id', async () => {
    await repo.create(makeRevision());
    const found = await repo.findById('rev-1');
    expect(found).not.toBeNull();
    expect(found!.projectId).toBe('proj-1');
    expect(found!.gitCommitSha).toBe('a'.repeat(40));
    expect(found!.toolchain).toEqual({ kicad: '8.0' });
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('finds by project id', async () => {
    await repo.create(makeRevision());
    await repo.create(makeRevision({ id: 'rev-2', gitCommitSha: 'b'.repeat(40) }));
    const results = await repo.findByProjectId('proj-1');
    expect(results).toHaveLength(2);
  });

  it('finds by git commit sha', async () => {
    await repo.create(makeRevision());
    const found = await repo.findByGitCommitSha('proj-1', 'a'.repeat(40));
    expect(found).not.toBeNull();
    expect(found!.id).toBe('rev-1');
  });

  it('finds by branch', async () => {
    await repo.create(makeRevision());
    await repo.create(makeRevision({ id: 'rev-2', gitCommitSha: 'b'.repeat(40), branchName: 'feature/x' }));
    const mainRevs = await repo.findByBranch('proj-1', 'main');
    expect(mainRevs).toHaveLength(1);
    const featureRevs = await repo.findByBranch('proj-1', 'feature/x');
    expect(featureRevs).toHaveLength(1);
  });

  it('updates status via valid transition', async () => {
    await repo.create(makeRevision());
    await repo.updateStatus('rev-1', 'imported');
    const found = await repo.findById('rev-1');
    expect(found!.status).toBe('imported');
  });

  it('rejects invalid transition', async () => {
    await repo.create(makeRevision());
    await expect(repo.updateStatus('rev-1', 'merged')).rejects.toThrow();
  });

  it('rejects status change on terminal state (merged)', async () => {
    await repo.create(makeRevision());
    await repo.updateStatus('rev-1', 'imported');
    await repo.updateStatus('rev-1', 'validating');
    await repo.updateStatus('rev-1', 'validated');
    await repo.updateStatus('rev-1', 'review');
    await repo.updateStatus('rev-1', 'merged');
    await expect(repo.updateStatus('rev-1', 'draft')).rejects.toThrow(/terminal/i);
  });

  it('throws on update of non-existent revision', async () => {
    await expect(repo.updateStatus('nope', 'imported')).rejects.toThrow(/not found/i);
  });

  it('sets snapshot hashes on draft revision', async () => {
    await repo.create(makeRevision());
    const hashes = {
      snapshotHash: sha256('snap'),
      engineeringObjectSnapshotHash: sha256('eo'),
      constraintSnapshotHash: sha256('con'),
      decisionSnapshotHash: sha256('dec'),
      bomSnapshotHash: sha256('bom'),
      artifactManifestHash: sha256('art'),
    };
    await repo.setSnapshotHashes('rev-1', hashes);
    const found = await repo.findById('rev-1');
    expect(found!.snapshotHash).toBe(hashes.snapshotHash);
    expect(found!.engineeringObjectSnapshotHash).toBe(hashes.engineeringObjectSnapshotHash);
  });

  it('rejects setting hashes on non-draft/imported revision', async () => {
    await repo.create(makeRevision());
    await repo.updateStatus('rev-1', 'imported');
    await repo.updateStatus('rev-1', 'validating');
    const hashes = {
      snapshotHash: sha256('snap'),
      engineeringObjectSnapshotHash: sha256('eo'),
      constraintSnapshotHash: sha256('con'),
      decisionSnapshotHash: sha256('dec'),
      bomSnapshotHash: sha256('bom'),
      artifactManifestHash: sha256('art'),
    };
    await expect(repo.setSnapshotHashes('rev-1', hashes)).rejects.toThrow(/cannot set snapshot hashes/i);
  });

  it('round-trips parent revision ids', async () => {
    await repo.create(makeRevision({ parentRevisionIds: ['rev-parent-1', 'rev-parent-2'] }));
    const found = await repo.findById('rev-1');
    expect(found!.parentRevisionIds).toEqual(['rev-parent-1', 'rev-parent-2']);
  });
});
