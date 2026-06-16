-- =====================================================================
-- LogicHub Analytics Dashboard Queries — v1
-- Firestore collections:
--   analyticsEvents       → immutable event log
--   analyticsDailyCounts  → mutable daily counter (fast reads)
-- =====================================================================
-- NOTE: These are written as Firestore-equivalent query descriptions
-- and can be run via Firebase Admin SDK or Firestore Console.
-- They are presented as SQL-style pseudocode for readability.
-- =====================================================================


-- ─── 1. DAILY SIGNUPS ────────────────────────────────────────────────────────
-- Fast read from daily counter:
--   db.collection("analyticsDailyCounts").doc("<YYYY-MM-DD>").get()
--   → field: signup_count

-- Range read (last 30 days):
--   db.collection("analyticsDailyCounts")
--     .where("date_key", ">=", "2026-05-17")
--     .orderBy("date_key", "asc")
--     .select("date_key", "signup_count")

SELECT date_key, signup_count
FROM   analyticsDailyCounts
WHERE  date_key >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER  BY date_key ASC;


-- ─── 2. PROJECTS CREATED ─────────────────────────────────────────────────────
SELECT date_key, project_created
FROM   analyticsDailyCounts
WHERE  date_key >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER  BY date_key ASC;


-- ─── 3. APK UPLOADS ──────────────────────────────────────────────────────────
SELECT date_key, apk_uploaded
FROM   analyticsDailyCounts
WHERE  date_key >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER  BY date_key ASC;


-- ─── 4. ZIP UPLOADS ──────────────────────────────────────────────────────────
SELECT date_key, zip_uploaded
FROM   analyticsDailyCounts
WHERE  date_key >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER  BY date_key ASC;


-- ─── 5. GITHUB IMPORTS ───────────────────────────────────────────────────────
SELECT date_key, github_imported
FROM   analyticsDailyCounts
WHERE  date_key >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER  BY date_key ASC;


-- ─── 6. PUBLISH CLICKS ───────────────────────────────────────────────────────
SELECT date_key, publish_clicked
FROM   analyticsDailyCounts
WHERE  date_key >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER  BY date_key ASC;


-- ─── 7. RETURNING USERS ──────────────────────────────────────────────────────
SELECT date_key, returning_users
FROM   analyticsDailyCounts
WHERE  date_key >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER  BY date_key ASC;


-- ─── FUNNEL CONVERSION VIEW ──────────────────────────────────────────────────
-- Aggregate across a date range to compute full funnel metrics.
-- (Replace date bounds as needed.)

SELECT
  SUM(signup_count)    AS total_signups,
  SUM(project_created) AS total_projects,
  SUM(apk_uploaded)    AS total_apk_uploads,
  SUM(zip_uploaded)    AS total_zip_uploads,
  SUM(github_imported) AS total_gh_imports,
  SUM(publish_clicked) AS total_publishes,
  SUM(returning_users) AS total_returning,

  -- Funnel Rates (assume unique visitor count is tracked externally via Cloudflare/Hanuman)
  ROUND(SUM(signup_count)    / NULLIF(SUM(signup_count), 0) * 100, 2) AS signup_rate_pct,
  ROUND(SUM(project_created) / NULLIF(SUM(signup_count), 0) * 100, 2) AS project_creation_rate_pct,
  ROUND(
    (SUM(apk_uploaded) + SUM(zip_uploaded) + SUM(github_imported))
    / NULLIF(SUM(project_created), 0) * 100,
    2
  ) AS import_rate_pct,
  ROUND(SUM(publish_clicked) / NULLIF(SUM(project_created), 0) * 100, 2) AS publish_rate_pct,
  ROUND(SUM(returning_users) / NULLIF(SUM(signup_count), 0) * 100, 2)    AS retention_rate_pct

FROM analyticsDailyCounts
WHERE date_key BETWEEN '2026-05-17' AND '2026-06-17';


-- ─── DROP-OFF POINT ANALYSIS ─────────────────────────────────────────────────
-- Which step loses the most users?

SELECT
  'Signup → Project'   AS funnel_step,
  ROUND(
    (1 - SUM(project_created) / NULLIF(SUM(signup_count), 0)) * 100, 2
  ) AS drop_off_pct
FROM analyticsDailyCounts WHERE date_key >= '2026-05-17'

UNION ALL

SELECT
  'Project → Import',
  ROUND(
    (1 - (SUM(apk_uploaded) + SUM(zip_uploaded) + SUM(github_imported))
       / NULLIF(SUM(project_created), 0)) * 100, 2
  )
FROM analyticsDailyCounts WHERE date_key >= '2026-05-17'

UNION ALL

SELECT
  'Import → Publish',
  ROUND(
    (1 - SUM(publish_clicked)
       / NULLIF(SUM(apk_uploaded) + SUM(zip_uploaded) + SUM(github_imported), 0)) * 100, 2
  )
FROM analyticsDailyCounts WHERE date_key >= '2026-05-17'

ORDER BY drop_off_pct DESC;


-- ─── RICH METADATA QUERY (from analyticsEvents collection) ───────────────────
-- For detailed investigation of a specific event (e.g., APK file sizes):
--   db.collection("analyticsEvents")
--     .where("event_name", "==", "apk_uploaded")
--     .where("date_key", "==", "2026-06-17")
--     .orderBy("created_at", "desc")
--     .limit(100)

SELECT event_name, user_id, project_id, metadata_json, created_at
FROM   analyticsEvents
WHERE  event_name = 'apk_uploaded'
  AND  date_key   = '2026-06-17'
ORDER  BY created_at DESC
LIMIT  100;
