import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../src/repositories/project.repository.js';
import { SqliteRevisionRepository } from '../src/repositories/revision.repository.js';
import { SqliteDecisionRepository } from '../src/repositories/decision.repository.js';
import { createTestDb, makeProject, makeRevision, makeDecision } from './helpers.js';

describe('SqliteDecisionRepository', () => {
  let db: Database.Database;
  let repo: SqliteDecisionRepository;

  beforeEach(async () => {
    db = createTestDb();
    const projRepo = new SqliteProjectRepository(db);
    const revRepo = new SqliteRevisionRepository(db);
    await projRepo.create(makeProject());
    await revRepo.create(makeRevision());
    repo = new SqliteDecisionRepository(db);
  });

  it('creates and finds by id', async () => {
    await repo.create(makeDecision());
    const found = await repo.findById('dec-1');
    expect(found).not.toBeNull();
    expect(found!.question).toBe('Which voltage regulator?');
    expect(found!.alternatives).toHaveLength(2);
    expect(found!.selectedAlternative).toBe('alt-1');
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('finds by revision id', async () => {
    await repo.create(makeDecision());
    await repo.create(makeDecision({ id: 'dec-2', question: 'Which MCU?' }));
    const results = await repo.findByRevisionId('rev-1');
    expect(results).toHaveLength(2);
  });

  it('round-trips complex json arrays', async () => {
    await repo.create(makeDecision({
      constraintsConsidered: ['con-1', 'con-2'],
      evidenceArtifactIds: ['art-1'],
      validationResultIds: ['vr-1'],
    }));
    const found = await repo.findById('dec-1');
    expect(found!.constraintsConsidered).toEqual(['con-1', 'con-2']);
    expect(found!.evidenceArtifactIds).toEqual(['art-1']);
    expect(found!.validationResultIds).toEqual(['vr-1']);
  });

  it('rejects duplicate id', async () => {
    await repo.create(makeDecision());
    await expect(repo.create(makeDecision())).rejects.toThrow();
  });
});
