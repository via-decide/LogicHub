import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../src/repositories/project.repository.js';
import { SqliteRevisionRepository } from '../src/repositories/revision.repository.js';
import { SqliteChangeIntentRepository } from '../src/repositories/change-intent.repository.js';
import { createTestDb, makeProject, makeRevision, makeChangeIntent } from './helpers.js';

describe('SqliteChangeIntentRepository', () => {
  let db: Database.Database;
  let repo: SqliteChangeIntentRepository;

  beforeEach(async () => {
    db = createTestDb();
    const projRepo = new SqliteProjectRepository(db);
    const revRepo = new SqliteRevisionRepository(db);
    await projRepo.create(makeProject());
    await revRepo.create(makeRevision());
    repo = new SqliteChangeIntentRepository(db);
  });

  it('creates and finds by id', async () => {
    await repo.create(makeChangeIntent());
    const found = await repo.findById('ci-1');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Add bypass capacitors');
    expect(found!.changeType).toBe('schematic_edit');
    expect(found!.approvalPolicy).toEqual({ requiredApprovals: 1, autoMerge: false });
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('finds by project id', async () => {
    await repo.create(makeChangeIntent());
    await repo.create(makeChangeIntent({ id: 'ci-2', title: 'Replace MCU' }));
    const results = await repo.findByProjectId('proj-1');
    expect(results).toHaveLength(2);
  });

  it('updates status via valid transition', async () => {
    await repo.create(makeChangeIntent());
    await repo.updateStatus('ci-1', 'planned');
    const found = await repo.findById('ci-1');
    expect(found!.status).toBe('planned');
  });

  it('rejects invalid transition', async () => {
    await repo.create(makeChangeIntent());
    await expect(repo.updateStatus('ci-1', 'accepted')).rejects.toThrow();
  });

  it('rejects status change on terminal state', async () => {
    await repo.create(makeChangeIntent());
    await repo.updateStatus('ci-1', 'cancelled');
    await expect(repo.updateStatus('ci-1', 'planned')).rejects.toThrow(/terminal/i);
  });

  it('throws on update of non-existent intent', async () => {
    await expect(repo.updateStatus('nope', 'planned')).rejects.toThrow(/not found/i);
  });

  it('round-trips preserve and optimize arrays', async () => {
    await repo.create(makeChangeIntent({
      preserve: ['net:VCC', 'net:GND'],
      optimize: ['cost', 'area'],
    }));
    const found = await repo.findById('ci-1');
    expect(found!.preserve).toEqual(['net:VCC', 'net:GND']);
    expect(found!.optimize).toEqual(['cost', 'area']);
  });
});
