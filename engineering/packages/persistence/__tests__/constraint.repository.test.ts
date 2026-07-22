import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../src/repositories/project.repository.js';
import { SqliteRevisionRepository } from '../src/repositories/revision.repository.js';
import { SqliteConstraintRepository } from '../src/repositories/constraint.repository.js';
import { createTestDb, makeProject, makeRevision, makeConstraint } from './helpers.js';

describe('SqliteConstraintRepository', () => {
  let db: Database.Database;
  let repo: SqliteConstraintRepository;

  beforeEach(async () => {
    db = createTestDb();
    const projRepo = new SqliteProjectRepository(db);
    const revRepo = new SqliteRevisionRepository(db);
    await projRepo.create(makeProject());
    await revRepo.create(makeRevision());
    repo = new SqliteConstraintRepository(db);
  });

  it('creates and finds by id', async () => {
    await repo.create(makeConstraint());
    const found = await repo.findById('con-1');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('VCC Range');
    expect(found!.category).toBe('electrical');
    expect(found!.severity).toBe('blocking');
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('finds by revision id', async () => {
    await repo.create(makeConstraint());
    await repo.create(makeConstraint({ id: 'con-2', name: 'Max Current' }));
    const results = await repo.findByRevisionId('rev-1');
    expect(results).toHaveLength(2);
  });

  it('updates evaluation and status', async () => {
    await repo.create(makeConstraint());
    await repo.update('con-1', { evaluation: 'pass', status: 'active' });
    const found = await repo.findById('con-1');
    expect(found!.evaluation).toBe('pass');
  });

  it('round-trips expression and expected', async () => {
    await repo.create(makeConstraint({
      expression: { type: 'range', min: 1.8, max: 3.6 },
      expected: { nominal: 3.3 },
    }));
    const found = await repo.findById('con-1');
    expect(found!.expression).toEqual({ type: 'range', min: 1.8, max: 3.6 });
    expect(found!.expected).toEqual({ nominal: 3.3 });
  });

  it('rejects duplicate id', async () => {
    await repo.create(makeConstraint());
    await expect(repo.create(makeConstraint())).rejects.toThrow();
  });
});
