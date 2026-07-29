import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../src/repositories/project.repository.js';
import { createTestDb, makeProject } from './helpers.js';

describe('SqliteProjectRepository', () => {
  let db: Database.Database;
  let repo: SqliteProjectRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new SqliteProjectRepository(db);
  });

  it('creates and finds by id', async () => {
    const project = makeProject();
    await repo.create(project);
    const found = await repo.findById('proj-1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('proj-1');
    expect(found!.slug).toBe('test-project');
    expect(found!.repository.provider).toBe('github');
  });

  it('finds by slug', async () => {
    await repo.create(makeProject());
    const found = await repo.findBySlug('test-project');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('proj-1');
  });

  it('returns null for non-existent id', async () => {
    const found = await repo.findById('nope');
    expect(found).toBeNull();
  });

  it('lists all projects', async () => {
    await repo.create(makeProject());
    await repo.create(makeProject({ id: 'proj-2', slug: 'second' }));
    const all = await repo.listAll();
    expect(all).toHaveLength(2);
  });

  it('updates partial fields', async () => {
    await repo.create(makeProject());
    await repo.update('proj-1', { name: 'Renamed', status: 'archived' });
    const found = await repo.findById('proj-1');
    expect(found!.name).toBe('Renamed');
    expect(found!.status).toBe('archived');
    expect(found!.slug).toBe('test-project');
  });

  it('throws on update of non-existent project', async () => {
    await expect(repo.update('nope', { name: 'x' })).rejects.toThrow(/not found/i);
  });

  it('rejects duplicate id', async () => {
    await repo.create(makeProject());
    await expect(repo.create(makeProject())).rejects.toThrow();
  });

  it('round-trips metadata', async () => {
    await repo.create(makeProject({ metadata: { custom: 42 } }));
    const found = await repo.findById('proj-1');
    expect(found!.metadata).toEqual({ custom: 42 });
  });
});
