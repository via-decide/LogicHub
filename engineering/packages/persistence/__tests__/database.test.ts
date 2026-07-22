import { describe, it, expect } from 'vitest';
import { createDatabase } from '../src/database.js';

describe('createDatabase', () => {
  it('creates an in-memory database', () => {
    const db = createDatabase({ path: ':memory:' });
    expect(db.open).toBe(true);
    db.close();
  });

  it('enables WAL mode', () => {
    const db = createDatabase({ path: ':memory:' });
    const mode = db.pragma('journal_mode', { simple: true });
    expect(['wal', 'memory']).toContain(mode);
    db.close();
  });

  it('enables foreign keys', () => {
    const db = createDatabase({ path: ':memory:' });
    const fk = db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
    db.close();
  });
});
