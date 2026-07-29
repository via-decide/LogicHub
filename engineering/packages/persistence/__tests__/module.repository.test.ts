import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteModuleRepository } from '../src/repositories/module.repository.js';
import { createTestDb, makeModule } from './helpers.js';

describe('SqliteModuleRepository', () => {
  let db: Database.Database;
  let repo: SqliteModuleRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new SqliteModuleRepository(db);
  });

  it('creates and finds by id', async () => {
    await repo.create(makeModule());
    const found = await repo.findById('mod-1');
    expect(found).not.toBeNull();
    expect(found!.namespace).toBe('acme');
    expect(found!.name).toBe('power-supply');
    expect(found!.version).toBe('1.0.0');
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('finds by namespace and name', async () => {
    await repo.create(makeModule());
    await repo.create(makeModule({ id: 'mod-2', version: '2.0.0' }));
    const results = await repo.findByNamespaceAndName('acme', 'power-supply');
    expect(results).toHaveLength(2);
  });

  it('lists all modules', async () => {
    await repo.create(makeModule());
    await repo.create(makeModule({ id: 'mod-2', namespace: 'beta', name: 'sensor' }));
    const all = await repo.listAll();
    expect(all).toHaveLength(2);
  });

  it('round-trips dependencies', async () => {
    await repo.create(makeModule({
      dependencies: [{ moduleId: 'mod-dep-1', versionConstraint: '^1.0.0' }],
    }));
    const found = await repo.findById('mod-1');
    expect(found!.dependencies).toHaveLength(1);
    expect(found!.dependencies[0]!.versionConstraint).toBe('^1.0.0');
  });

  it('round-trips maintainers and requirements', async () => {
    await repo.create(makeModule({
      maintainers: ['alice', 'bob'],
      requirements: ['3.3V output', '500mA min'],
    }));
    const found = await repo.findById('mod-1');
    expect(found!.maintainers).toEqual(['alice', 'bob']);
    expect(found!.requirements).toEqual(['3.3V output', '500mA min']);
  });

  it('rejects duplicate id', async () => {
    await repo.create(makeModule());
    await expect(repo.create(makeModule())).rejects.toThrow();
  });
});
