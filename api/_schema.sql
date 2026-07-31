-- LogicHub/api/_schema.sql
-- Forward-only schema for the Postgres-backed write paths. Run explicitly via
-- `node scripts/migrate.mjs`, never applied implicitly at request time.
--
-- `documents` is a generic Firestore-shaped store (collection/doc_id/data)
-- backing `api/_pg.js`'s PostgresFirestoreCompat — this is what lets
-- `_orders.js`, `waitlist.js`, and `waitlist-confirm.js` keep their existing
-- `db.collection(x).doc(y).get()/.set(data, {merge})` calls unchanged; only
-- what `getAdminDb()` resolves to, in the four call sites that import from
-- `_pg.js` instead of `_sovereignAuth.js`, changes.
--
-- `waitlist_rate_limit_counters` is a real table, not a JSONB document,
-- because the rate limiter needs an atomic
-- `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count` to close the
-- read-then-write race the old get/set-based implementation had — that
-- can't be expressed through the generic document interface above.

CREATE TABLE IF NOT EXISTS documents (
  collection TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, doc_id)
);

CREATE TABLE IF NOT EXISTS waitlist_rate_limit_counters (
  bucket_key TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);
