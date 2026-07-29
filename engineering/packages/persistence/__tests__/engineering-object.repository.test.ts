import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../src/repositories/project.repository.js';
import { SqliteRevisionRepository } from '../src/repositories/revision.repository.js';
import { SqliteEngineeringObjectRepository } from '../src/repositories/engineering-object.repository.js';
import { createTestDb, makeProject, makeRevision, makeEngineeringObject, sha256 } from './helpers.js';

describe('SqliteEngineeringObjectRepository', () => {
  let db: Database.Database;
  let repo: SqliteEngineeringObjectRepository;

  beforeEach(async () => {
    db = createTestDb();
    const projRepo = new SqliteProjectRepository(db);
    const revRepo = new SqliteRevisionRepository(db);
    await projRepo.create(makeProject());
    await revRepo.create(makeRevision());
    repo = new SqliteEngineeringObjectRepository(db);
  });

  it('creates and finds by id', async () => {
    await repo.create(makeEngineeringObject());
    const found = await repo.findById('eo-1');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('R1');
    expect(found!.objectType).toBe('component');
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('finds by revision id', async () => {
    await repo.create(makeEngineeringObject());
    await repo.create(makeEngineeringObject({
      id: 'eo-2', name: 'C1', semanticKey: 'component:C1',
      contentHash: sha256('content-2'), semanticHash: sha256('semantic-2'),
    }));
    const results = await repo.findByRevisionId('rev-1');
    expect(results).toHaveLength(2);
  });

  it('finds by semantic key', async () => {
    await repo.create(makeEngineeringObject());
    const found = await repo.findBySemanticKey('rev-1', 'component:R1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('eo-1');
  });

  it('finds by type', async () => {
    await repo.create(makeEngineeringObject());
    await repo.create(makeEngineeringObject({
      id: 'eo-2', name: 'N1', objectType: 'net', semanticKey: 'net:VCC',
      contentHash: sha256('content-3'), semanticHash: sha256('semantic-3'),
    }));
    const components = await repo.findByType('rev-1', 'component');
    expect(components).toHaveLength(1);
    const nets = await repo.findByType('rev-1', 'net');
    expect(nets).toHaveLength(1);
  });

  it('createMany inserts batch atomically', async () => {
    const objects = [
      makeEngineeringObject({ id: 'eo-a', semanticKey: 'a', contentHash: sha256('a'), semanticHash: sha256('sa') }),
      makeEngineeringObject({ id: 'eo-b', semanticKey: 'b', contentHash: sha256('b'), semanticHash: sha256('sb') }),
      makeEngineeringObject({ id: 'eo-c', semanticKey: 'c', contentHash: sha256('c'), semanticHash: sha256('sc') }),
    ];
    await repo.createMany(objects);
    const all = await repo.findByRevisionId('rev-1');
    expect(all).toHaveLength(3);
  });

  it('round-trips properties and relationships', async () => {
    await repo.create(makeEngineeringObject({
      properties: { value: '100nF', tolerance: '10%' },
      relationships: [{ type: 'connects_to', targetId: 'eo-2', metadata: {} }],
    }));
    const found = await repo.findById('eo-1');
    expect(found!.properties).toEqual({ value: '100nF', tolerance: '10%' });
    expect(found!.relationships).toHaveLength(1);
    expect(found!.relationships[0]!.type).toBe('connects_to');
  });

  it('rejects duplicate id', async () => {
    await repo.create(makeEngineeringObject());
    await expect(repo.create(makeEngineeringObject())).rejects.toThrow();
  });
});
