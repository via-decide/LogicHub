import Database from 'better-sqlite3';

export interface DatabaseOptions {
  path: string;
  readonly?: boolean;
}

export function createDatabase(options: DatabaseOptions): Database.Database {
  const db = new Database(options.path, {
    readonly: options.readonly ?? false,
  });

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  return db;
}
