import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../src/repositories/project.repository.js';
import { SqliteRevisionRepository } from '../src/repositories/revision.repository.js';
import { SqliteValidationResultRepository } from '../src/repositories/validation-result.repository.js';
import { createTestDb, makeProject, makeRevision, makeValidationResult } from './helpers.js';

describe('SqliteValidationResultRepository', () => {
  let db: Database.Database;
  let repo: SqliteValidationResultRepository;

  beforeEach(async () => {
    db = createTestDb();
    const projRepo = new SqliteProjectRepository(db);
    const revRepo = new SqliteRevisionRepository(db);
    await projRepo.create(makeProject());
    await revRepo.create(makeRevision());
    repo = new SqliteValidationResultRepository(db);
  });

  it('creates and finds by id', async () => {
    await repo.create(makeValidationResult());
    const found = await repo.findById('vr-1');
    expect(found).not.toBeNull();
    expect(found!.validator).toBe('kicad-erc');
    expect(found!.validationType).toBe('erc');
    expect(found!.status).toBe('pass');
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('finds by revision id', async () => {
    await repo.create(makeValidationResult());
    await repo.create(makeValidationResult({ id: 'vr-2', validationType: 'drc' }));
    const results = await repo.findByRevisionId('rev-1');
    expect(results).toHaveLength(2);
  });

  it('round-trips diagnostics', async () => {
    await repo.create(makeValidationResult({
      diagnostics: [
        { severity: 'warning', message: 'Unconnected pin' },
        { severity: 'error', message: 'Short circuit', code: 'ERC001' },
      ],
    }));
    const found = await repo.findById('vr-1');
    expect(found!.diagnostics).toHaveLength(2);
    expect(found!.diagnostics[0]!.severity).toBe('warning');
    expect(found!.diagnostics[1]!.code).toBe('ERC001');
  });

  it('round-trips optional fields', async () => {
    await repo.create(makeValidationResult({
      completedAt: '2025-01-15T10:05:00.000Z',
      durationMs: 5000,
      metrics: { errors: 0, warnings: 2 },
      environment: { os: 'linux', arch: 'x64' },
    }));
    const found = await repo.findById('vr-1');
    expect(found!.completedAt).toBe('2025-01-15T10:05:00.000Z');
    expect(found!.durationMs).toBe(5000);
    expect(found!.metrics).toEqual({ errors: 0, warnings: 2 });
    expect(found!.environment).toEqual({ os: 'linux', arch: 'x64' });
  });

  it('rejects duplicate id', async () => {
    await repo.create(makeValidationResult());
    await expect(repo.create(makeValidationResult())).rejects.toThrow();
  });
});
