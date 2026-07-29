import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../src/repositories/project.repository.js';
import { SqliteRevisionRepository } from '../src/repositories/revision.repository.js';
import { SqliteArtifactRepository } from '../src/repositories/artifact.repository.js';
import { createTestDb, makeProject, makeRevision, makeArtifact, sha256 } from './helpers.js';

describe('SqliteArtifactRepository', () => {
  let db: Database.Database;
  let repo: SqliteArtifactRepository;

  beforeEach(async () => {
    db = createTestDb();
    const projRepo = new SqliteProjectRepository(db);
    const revRepo = new SqliteRevisionRepository(db);
    await projRepo.create(makeProject());
    await revRepo.create(makeRevision());
    repo = new SqliteArtifactRepository(db);
  });

  it('creates and finds by id', async () => {
    await repo.create(makeArtifact());
    const found = await repo.findById('art-1');
    expect(found).not.toBeNull();
    expect(found!.filename).toBe('main.kicad_sch');
    expect(found!.role).toBe('source');
    expect(found!.byteSize).toBe(1024);
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('finds by revision id', async () => {
    await repo.create(makeArtifact());
    await repo.create(makeArtifact({
      id: 'art-2', filename: 'board.kicad_pcb',
      sha256: sha256('artifact-content-2'), storageKey: 'cd/' + sha256('artifact-content-2'),
    }));
    const results = await repo.findByRevisionId('rev-1');
    expect(results).toHaveLength(2);
  });

  it('finds by sha256', async () => {
    const hash = sha256('artifact-content-1');
    await repo.create(makeArtifact());
    const results = await repo.findBySha256(hash);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('art-1');
  });

  it('round-trips source paths and provenance', async () => {
    await repo.create(makeArtifact({
      sourcePaths: ['src/main.kicad_sch', 'src/power.kicad_sch'],
      provenance: { tool: 'kicad', version: '8.0' },
    }));
    const found = await repo.findById('art-1');
    expect(found!.sourcePaths).toEqual(['src/main.kicad_sch', 'src/power.kicad_sch']);
    expect(found!.provenance).toEqual({ tool: 'kicad', version: '8.0' });
  });

  it('rejects duplicate id', async () => {
    await repo.create(makeArtifact());
    await expect(repo.create(makeArtifact())).rejects.toThrow();
  });
});
