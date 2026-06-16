-- LogicHub Analytics Schema — v1
-- Firestore is the live datastore; this SQL schema serves as:
--   1. A documentation contract for the shape of all analytics documents
--   2. A migration template if the data is ever exported to PostgreSQL

-- ─── analyticsEvents (Immutable event log) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id            TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  event_name    TEXT        NOT NULL
                            CHECK (event_name IN (
                              'signup_count',
                              'project_created',
                              'apk_uploaded',
                              'zip_uploaded',
                              'github_imported',
                              'publish_clicked',
                              'returning_users'
                            )),
  user_id       TEXT,
  project_id    TEXT,
  session_id    TEXT,
  metadata_json JSONB       NOT NULL DEFAULT '{}',
  date_key      DATE        NOT NULL,                  -- YYYY-MM-DD for fast range queries
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id)
);

-- Indexes for dashboard query patterns
CREATE INDEX IF NOT EXISTS idx_ae_event_name   ON analytics_events (event_name);
CREATE INDEX IF NOT EXISTS idx_ae_date_key     ON analytics_events (date_key);
CREATE INDEX IF NOT EXISTS idx_ae_user_id      ON analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_ae_project_id   ON analytics_events (project_id);
CREATE INDEX IF NOT EXISTS idx_ae_event_date   ON analytics_events (event_name, date_key);


-- ─── analyticsDailyCounts (Mutable daily aggregates) ─────────────────────────
CREATE TABLE IF NOT EXISTS analytics_daily_counts (
  date_key         DATE    NOT NULL,
  signup_count     INTEGER NOT NULL DEFAULT 0,
  project_created  INTEGER NOT NULL DEFAULT 0,
  apk_uploaded     INTEGER NOT NULL DEFAULT 0,
  zip_uploaded     INTEGER NOT NULL DEFAULT 0,
  github_imported  INTEGER NOT NULL DEFAULT 0,
  publish_clicked  INTEGER NOT NULL DEFAULT 0,
  returning_users  INTEGER NOT NULL DEFAULT 0,
  last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (date_key)
);

-- ─── Materialised Funnel View ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW analytics_funnel AS
SELECT
  date_key,
  signup_count,
  project_created,
  (apk_uploaded + zip_uploaded + github_imported) AS total_imports,
  apk_uploaded,
  zip_uploaded,
  github_imported,
  publish_clicked,
  returning_users,

  -- Conversion rates (null-safe)
  ROUND(project_created::NUMERIC / NULLIF(signup_count,    0) * 100, 2) AS project_creation_rate_pct,
  ROUND(
    (apk_uploaded + zip_uploaded + github_imported)::NUMERIC
    / NULLIF(project_created, 0) * 100, 2
  )                                                                       AS import_rate_pct,
  ROUND(publish_clicked::NUMERIC / NULLIF(project_created, 0) * 100, 2) AS publish_rate_pct,
  ROUND(returning_users::NUMERIC / NULLIF(signup_count,    0) * 100, 2) AS retention_rate_pct

FROM analytics_daily_counts
ORDER BY date_key DESC;
