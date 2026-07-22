import type Database from 'better-sqlite3';
import * as m001 from './001-initial-schema.js';

const migrations = [m001];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[])
      .map(row => row.name),
  );

  const applyMigration = db.transaction((name: string, sql: string) => {
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
  });

  for (const m of migrations) {
    if (!applied.has(m.name)) {
      applyMigration(m.name, m.sql);
    }
  }
}
