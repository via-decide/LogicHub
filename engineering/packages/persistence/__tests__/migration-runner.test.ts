import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createDatabase } from '../src/database.js';
import { runMigrations } from '../src/migrations/index.js';

describe('runMigrations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase({ path: ':memory:' });
  });

  it('creates all tables', () => {
    runMigrations(db);
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain('projects');
    expect(names).toContain('revisions');
    expect(names).toContain('engineering_objects');
    expect(names).toContain('constraints');
    expect(names).toContain('decisions');
    expect(names).toContain('artifacts');
    expect(names).toContain('change_intents');
    expect(names).toContain('validation_results');
    expect(names).toContain('modules');
    expect(names).toContain('engineering_pull_requests');
  });

  it('is idempotent', () => {
    runMigrations(db);
    runMigrations(db);
    const migrations = db.prepare('SELECT * FROM _migrations').all();
    expect(migrations).toHaveLength(1);
  });

  it('tracks applied migrations', () => {
    runMigrations(db);
    const rows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[];
    expect(rows[0]!.name).toBe('001-initial-schema');
  });
});
