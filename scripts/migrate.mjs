#!/usr/bin/env node
// LogicHub/scripts/migrate.mjs
// Applies api/_schema.sql against DATABASE_URL. Run explicitly
// (`node scripts/migrate.mjs`), never implicitly at request time.
//
// Every statement in _schema.sql is written with IF NOT EXISTS, so applying
// it more than once is a no-op rather than an error — that's what makes this
// safe to re-run without a separate migration-tracking table for now. If a
// second schema file is ever added (e.g. for the marketplace tables in a
// later slice), extend this to iterate api/migrations/*.sql in order instead
// of rewriting this runner.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'api', '_schema.sql');

async function main() {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (!url) {
    console.error('DATABASE_URL is not set. Nothing to migrate against.');
    process.exit(1);
  }

  const schema = readFileSync(schemaPath, 'utf8');
  const sql = postgres(url, { max: 1 });

  try {
    console.log(`Applying ${schemaPath}...`);
    await sql.unsafe(schema);
    console.log('Schema applied.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
