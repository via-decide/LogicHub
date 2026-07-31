// LogicHub/api/_pg.js
// Postgres-backed replacement for the SQLite-backed `firestoreCompat` in
// `_sovereignDb.js` — for the write paths that are actually broken on Vercel
// (better-sqlite3 has no native build step here and its file is written
// beside the source, which is read-only and ephemeral on Vercel's function
// filesystem).
//
// Driver: `postgres` (postgres.js). No native build step, unlike
// better-sqlite3 — that's half of why the old dependency doesn't work here.
//
// The database is created lazily and memoized per process, and there is no
// fallback connection string. Mirrors `_payments-config.js`'s
// `razorpayCredentials()`: a missing DATABASE_URL is a named configuration
// error at the point of use, not a silent no-op or an empty-string substitute.
//
// `postgres` is required lazily, inside `getSql()`, rather than imported at
// the top of this file. A static top-level import fails at module *load*
// time if the package isn't installed — which blocks even loading this
// file's other exports (`getAdminDb`, `__setAdminDbForTesting`) for a test
// that substitutes a fake db and never touches a real connection at all
// (see tests/marketplace-handlers.test.mjs). Loading it lazily means the
// dependency is only required at the moment a real connection is actually
// attempted, which is exactly the boundary tests need to stay on the fake
// side of.
//
// The query/transaction/batch/FieldValue machinery below (where/orderBy/
// limit chaining, sentinel values, wrapTimestamps) is a Postgres/JSONB port
// of `_sovereignDb.js`'s SQLite implementation — same interface, same
// sentinel shapes (`{ __type: 'increment' | 'serverTimestamp' | 'timestamp' }`,
// produced by `_sovereignAuth.js`'s `admin.firestore.FieldValue` mock), so
// `_sovereignAuth.js` can delegate `getAdminDb()` here without its callers
// (`founder-request.js`'s transactional UTR lock, `_analyticsService.js`'s
// batched counters, `admin/dashboard.js`'s filtered queries, etc.) changing
// at all.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let client = null;

/** The raw postgres.js client, or a descriptive throw if unconfigured. */
export function getSql() {
  if (client) return client;

  const url = String(process.env.DATABASE_URL || '').trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. The Postgres-backed write paths (waitlist, orders, '
      + 'marketplace) cannot run without it.',
    );
  }

  const postgres = require('postgres');
  client = postgres(url, {
    // Vercel functions are short-lived; a small pool avoids exhausting a
    // pooler's connection limit across many concurrent invocations.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return client;
}

/**
 * Firestore Timestamp-alike for fields whose name matches the same
 * heuristics `_sovereignDb.js` used (`_at`, `_ts`, `timestamp`, ...): gives
 * callers `.toDate()` without changing what `JSON.stringify`/`res.json()`
 * emit for the same field (`toJSON()` keeps existing marketplace responses,
 * none of which call `.toDate()` today, byte-for-byte identical).
 */
class TimestampCompat {
  constructor(isoString) {
    this.isoString = isoString;
  }

  toDate() {
    return new Date(this.isoString);
  }

  toString() {
    return this.isoString;
  }

  toJSON() {
    return this.isoString;
  }
}

const TIMESTAMP_KEY_PATTERN = /(_at|_ts)$/;
const TIMESTAMP_KEYS = new Set([
  'timestamp', 'last_updated', 'reviewed_at', 'grantedAt', 'updatedAt',
  'publishedAt', 'created_at', 'last_seen_at',
]);

function wrapTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(wrapTimestamps);

  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && (TIMESTAMP_KEY_PATTERN.test(k) || TIMESTAMP_KEYS.has(k)) && !Number.isNaN(Date.parse(v))) {
      result[k] = new TimestampCompat(v);
      continue;
    }
    result[k] = wrapTimestamps(v);
  }
  return result;
}

/**
 * Splits a write payload into plain fields (sentinels already resolved to
 * literal values — `serverTimestamp`/`timestamp` need no read, unlike
 * `increment`) and a list of `{ field, delta }` increments that still need
 * server-side arithmetic.
 */
function splitSentinels(data, now) {
  const plain = {};
  const increments = [];
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && v.__type === 'increment') {
      increments.push({ field: k, delta: v.value });
    } else if (v && typeof v === 'object' && v.__type === 'serverTimestamp') {
      plain[k] = now;
    } else if (v && typeof v === 'object' && v.__type === 'timestamp') {
      plain[k] = v.value;
    } else {
      plain[k] = v;
    }
  }
  return { plain, increments };
}

/**
 * A document snapshot, matching the `{ exists, data() }` shape every caller
 * of the old `firestoreCompat` already expects (`_orders.js`, `waitlist.js`,
 * `waitlist-confirm.js`) — this is what makes the swap a driver change and
 * not a rewrite of those files.
 */
function snapshotFrom(id, row) {
  return {
    id,
    exists: Boolean(row),
    data: () => (row ? wrapTimestamps(row.data) : undefined),
  };
}

function randomDocId() {
  return 'doc_' + Math.random().toString(36).slice(2, 11);
}

class DocumentRef {
  constructor(sql, collection, docId) {
    this.sql = sql;
    this.collection = collection;
    this.docId = String(docId);
  }

  async get(sql = this.sql) {
    const rows = await sql`
      SELECT data FROM documents
      WHERE collection = ${this.collection} AND doc_id = ${this.docId}
    `;
    return snapshotFrom(this.docId, rows[0]);
  }

  /**
   * `{ merge: true }` shallow-merges into the stored JSONB document.
   * `serverTimestamp`/`timestamp` sentinels resolve to literal values before
   * the query runs (no read needed). `increment` is different: outside a
   * merge, there's nothing to add to (the doc is being replaced, so the
   * delta just becomes the literal value); under a merge, it's applied as a
   * single atomic `jsonb_set(... COALESCE(old,0) + delta ...)` inside the
   * same `INSERT ... ON CONFLICT`, not a separate read-then-write — matching
   * real Firestore's `increment()`, which is atomic even outside a
   * transaction (`_analyticsService.js`'s per-day counters and
   * `_appAnalytics.js`'s `viewCount` both call it standalone, under real
   * concurrent traffic).
   */
  async set(data, options = {}, sql = this.sql) {
    const merge = Boolean(options.merge);
    const now = new Date().toISOString();
    const { plain, increments } = splitSentinels(data, now);

    if (increments.length === 0) {
      const insertData = plain;
      if (merge) {
        await sql`
          INSERT INTO documents (collection, doc_id, data, updated_at)
          VALUES (${this.collection}, ${this.docId}, ${sql.json(insertData)}, now())
          ON CONFLICT (collection, doc_id)
          DO UPDATE SET data = documents.data || EXCLUDED.data, updated_at = now()
        `;
      } else {
        await sql`
          INSERT INTO documents (collection, doc_id, data, updated_at)
          VALUES (${this.collection}, ${this.docId}, ${sql.json(insertData)}, now())
          ON CONFLICT (collection, doc_id)
          DO UPDATE SET data = EXCLUDED.data, updated_at = now()
        `;
      }
      return undefined;
    }

    if (!merge) {
      // No prior state to add to — the document is being replaced, so each
      // increment's delta is simply its literal starting value.
      const insertData = { ...plain, ...Object.fromEntries(increments.map((i) => [i.field, i.delta])) };
      await sql`
        INSERT INTO documents (collection, doc_id, data, updated_at)
        VALUES (${this.collection}, ${this.docId}, ${sql.json(insertData)}, now())
        ON CONFLICT (collection, doc_id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = now()
      `;
      return undefined;
    }

    const insertData = { ...plain, ...Object.fromEntries(increments.map((i) => [i.field, i.delta])) };
    let mergedExpr = sql`documents.data || EXCLUDED.data`;
    for (const { field, delta } of increments) {
      mergedExpr = sql`jsonb_set(${mergedExpr}, ${'{' + field + '}'}, to_jsonb(COALESCE((documents.data->>${field})::numeric, 0) + ${delta}))`;
    }

    await sql`
      INSERT INTO documents (collection, doc_id, data, updated_at)
      VALUES (${this.collection}, ${this.docId}, ${sql.json(insertData)}, now())
      ON CONFLICT (collection, doc_id)
      DO UPDATE SET data = ${mergedExpr}, updated_at = now()
    `;
    return undefined;
  }

  async update(data, sql = this.sql) {
    return this.set(data, { merge: true }, sql);
  }

  async delete(sql = this.sql) {
    await sql`
      DELETE FROM documents WHERE collection = ${this.collection} AND doc_id = ${this.docId}
    `;
  }
}

function jsonbPath(field) {
  // Only top-level fields are used by any caller today (no dotted paths) —
  // matches `_sovereignDb.js`'s `json_extract(data, '$.field')` scope.
  return field;
}

function translateWhere(field, op, val) {
  const sqlOp = op === '==' ? '=' : op;
  const path = jsonbPath(field);
  const isNumeric = typeof val === 'number';
  // `sql.unsafe` interpolation of the operator is safe here — `sqlOp` only
  // ever comes from `translateWhere`'s own callers passing a literal
  // comparison operator string, never request input.
  return { path, sqlOp, val, isNumeric };
}

class CollectionRef {
  constructor(sql, name, query = { wheres: [], orderBys: [], limitN: null }) {
    this.sql = sql;
    this.name = name;
    this.query = query;
  }

  doc(docId) {
    return new DocumentRef(this.sql, this.name, docId || randomDocId());
  }

  where(field, op, val) {
    const wheres = [...this.query.wheres, translateWhere(field, op, val)];
    return new CollectionRef(this.sql, this.name, { ...this.query, wheres });
  }

  orderBy(field, direction = 'asc') {
    const orderBys = [...this.query.orderBys, { field: jsonbPath(field), direction }];
    return new CollectionRef(this.sql, this.name, { ...this.query, orderBys });
  }

  limit(n) {
    return new CollectionRef(this.sql, this.name, { ...this.query, limitN: n });
  }

  /** Chainable `where()/orderBy()/limit()` query, terminated by `get()`. */
  async get() {
    const sql = this.sql;
    const conditions = this.query.wheres.map((w) => {
      const expr = w.isNumeric
        ? sql`CAST(data->>${w.path} AS NUMERIC) ${sql.unsafe(w.sqlOp)} ${w.val}`
        : sql`data->>${w.path} ${sql.unsafe(w.sqlOp)} ${String(w.val)}`;
      return expr;
    });

    let whereClause = sql`collection = ${this.name}`;
    for (const cond of conditions) {
      whereClause = sql`${whereClause} AND ${cond}`;
    }

    let orderClause = sql``;
    if (this.query.orderBys.length > 0) {
      const parts = this.query.orderBys.map((o) => sql`data->>${o.field} ${sql.unsafe(o.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC')}`);
      let joined = parts[0];
      for (let i = 1; i < parts.length; i += 1) joined = sql`${joined}, ${parts[i]}`;
      orderClause = sql`ORDER BY ${joined}`;
    }

    const limitClause = this.query.limitN != null ? sql`LIMIT ${this.query.limitN}` : sql``;

    const rows = await sql`
      SELECT doc_id, data FROM documents
      WHERE ${whereClause}
      ${orderClause}
      ${limitClause}
    `;

    const docs = rows.map((row) => snapshotFrom(row.doc_id, row));
    return {
      docs,
      get size() { return docs.length; },
      get empty() { return docs.length === 0; },
      forEach(cb) { docs.forEach(cb); },
    };
  }

  /**
   * List documents in this collection, optionally filtered by one top-level
   * field equality (all `issues.js`/`release.js` need). Predates the
   * chainable `where()/orderBy()/limit()` above — kept as-is for those two
   * call sites rather than rewritten in terms of it, to not touch working
   * marketplace routes while extending this file for `_sovereignAuth.js`.
   */
  async list({ where } = {}) {
    const sql = this.sql;
    const rows = where
      ? await sql`
          SELECT doc_id, data FROM documents
          WHERE collection = ${this.name} AND data->>${where.field} = ${String(where.value)}
          ORDER BY updated_at DESC
        `
      : await sql`
          SELECT doc_id, data FROM documents
          WHERE collection = ${this.name}
          ORDER BY updated_at DESC
        `;
    return rows.map((row) => ({ id: row.doc_id, data: () => row.data }));
  }
}

/** Mirrors `_sovereignDb.js`'s `Filter.or/and/where` builder (unused by any
 * current `_sovereignAuth.js` caller — `public-feed.js` uses the real
 * `firebase-admin/firestore` package's `Filter` instead — kept for parity
 * so a future caller importing this mock's `Filter` doesn't silently get
 * an unsupported shape). */
export const Filter = {
  or: (...filters) => ({ isFilter: true, op: 'OR', filters }),
  and: (...filters) => ({ isFilter: true, op: 'AND', filters }),
  where: (field, op, val) => ({ field, op, val }),
};

class Batch {
  constructor(sql) {
    this.sql = sql;
    this.ops = [];
  }

  set(docRef, data, options) {
    this.ops.push({ type: 'set', docRef, data, options });
  }

  update(docRef, data) {
    this.ops.push({ type: 'update', docRef, data });
  }

  delete(docRef) {
    this.ops.push({ type: 'delete', docRef });
  }

  async commit() {
    await this.sql.begin(async (tx) => {
      for (const op of this.ops) {
        if (op.type === 'set') await op.docRef.set(op.data, op.options || {}, tx);
        else if (op.type === 'update') await op.docRef.update(op.data, tx);
        else if (op.type === 'delete') await op.docRef.delete(tx);
      }
    });
  }
}

class PostgresFirestoreCompat {
  constructor(sql) {
    this.sql = sql;
  }

  collection(name) {
    return new CollectionRef(this.sql, name);
  }

  batch() {
    return new Batch(this.sql);
  }

  /**
   * Real Postgres transaction via `sql.begin()` — unlike the SQLite version's
   * `BEGIN IMMEDIATE` (which only ever serialized access within one process
   * on one file), this gives `founder-request.js`'s UTR-dedup check actual
   * cross-invocation isolation across Vercel's concurrent function
   * instances, via `SELECT ... FOR UPDATE` on the transactional `get()`.
   */
  async runTransaction(cb) {
    return this.sql.begin(async (tx) => {
      const txContext = {
        // `SELECT ... FOR UPDATE` can't lock a row that doesn't exist yet,
        // which is exactly the case a check-then-insert dedup lock depends
        // on (`founder-request.js`'s UTR check: first claim always finds no
        // row). A transaction-scoped advisory lock, keyed on collection+id,
        // closes that gap instead — a second `tx.get()` on the same
        // collection+id blocks until the first transaction commits or rolls
        // back (Postgres releases `pg_advisory_xact_lock` automatically at
        // transaction end), so the second caller only ever reads
        // post-commit state. Scoped to `runTransaction` only, not the plain
        // `get()` every other caller uses, so unrelated reads aren't
        // serialized against each other.
        get: async (docRef) => {
          await tx`SELECT pg_advisory_xact_lock(hashtext(${`${docRef.collection}:${docRef.docId}`}))`;
          return docRef.get(tx);
        },
        set: (docRef, data, options) => docRef.set(data, options || {}, tx),
        update: (docRef, data) => docRef.update(data, tx),
        delete: (docRef) => docRef.delete(tx),
      };
      return cb(txContext);
    });
  }

  /**
   * Escape hatch for callers that need real atomic SQL — the generic
   * get-then-merge-set document interface above cannot express an atomic
   * increment (`_waitlist.js`'s rate-limit counter needs
   * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count`, not a
   * read-then-write, to close the race the old implementation had). Exposed
   * explicitly rather than silently, so it's obvious which callers depend on
   * a real Postgres connection instead of the document-store abstraction.
   */
  get raw() {
    return this.sql;
  }
}

let adminDb = null;

/** The Postgres-backed equivalent of `_sovereignAuth.js`'s `getAdminDb()`. */
export function getAdminDb() {
  if (adminDb) return adminDb;
  adminDb = new PostgresFirestoreCompat(getSql());
  return adminDb;
}

/**
 * Test-only override for the `getAdminDb()` singleton.
 *
 * `api/marketplace/*.js` handlers call `getAdminDb()` internally rather than
 * taking it as a parameter (unlike `_orders.js`'s functions, which already
 * do) — a real Vercel function's signature is `(req, res)`, not a place to
 * thread a database through. This is the seam that lets
 * `tests/marketplace-handlers.test.mjs` substitute a fake, in-memory store
 * without touching handler code or requiring a live Postgres connection.
 * Never called from any production code path — grep for it before assuming
 * otherwise.
 */
export function __setAdminDbForTesting(db) {
  adminDb = db;
}
