export const name = '001-initial-schema';

export const sql = `
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private', 'organization')),
  repository TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'suspended')),
  metadata TEXT
);

CREATE TABLE revisions (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  git_commit_sha TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  parent_revision_ids TEXT NOT NULL,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  snapshot_hash TEXT,
  engineering_object_snapshot_hash TEXT,
  constraint_snapshot_hash TEXT,
  decision_snapshot_hash TEXT,
  bom_snapshot_hash TEXT,
  artifact_manifest_hash TEXT,
  toolchain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','imported','validating','validated','review','merged','rejected','failed')),
  metadata TEXT
);
CREATE INDEX idx_revisions_project ON revisions(project_id);
CREATE INDEX idx_revisions_git_sha ON revisions(git_commit_sha);
CREATE INDEX idx_revisions_branch ON revisions(project_id, branch_name);

CREATE TABLE engineering_objects (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  revision_id TEXT NOT NULL REFERENCES revisions(id),
  object_type TEXT NOT NULL,
  source_path TEXT NOT NULL,
  source_object_id TEXT,
  name TEXT NOT NULL,
  semantic_key TEXT NOT NULL,
  properties TEXT NOT NULL,
  relationships TEXT NOT NULL,
  geometry TEXT,
  content_hash TEXT NOT NULL,
  semantic_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata TEXT
);
CREATE INDEX idx_eo_revision ON engineering_objects(revision_id);
CREATE INDEX idx_eo_semantic_key ON engineering_objects(revision_id, semantic_key);
CREATE INDEX idx_eo_type ON engineering_objects(revision_id, object_type);

CREATE TABLE constraints (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  revision_id TEXT NOT NULL REFERENCES revisions(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'blocking')),
  scope TEXT NOT NULL,
  target_object_ids TEXT NOT NULL,
  expression TEXT,
  unit TEXT,
  expected TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  evaluation TEXT NOT NULL DEFAULT 'unknown'
    CHECK (evaluation IN ('pass','warning','violation','unknown','requires_validation','error')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  metadata TEXT
);
CREATE INDEX idx_constraints_revision ON constraints(revision_id);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  revision_id TEXT NOT NULL REFERENCES revisions(id),
  change_intent_id TEXT,
  question TEXT NOT NULL,
  context TEXT,
  alternatives TEXT NOT NULL,
  selected_alternative TEXT,
  rationale TEXT,
  tradeoffs TEXT,
  constraints_considered TEXT NOT NULL,
  evidence_artifact_ids TEXT NOT NULL,
  validation_result_ids TEXT NOT NULL,
  confidence TEXT,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','accepted','rejected','superseded')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  supersedes_decision_id TEXT,
  metadata TEXT
);
CREATE INDEX idx_decisions_revision ON decisions(revision_id);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  revision_id TEXT NOT NULL REFERENCES revisions(id),
  role TEXT NOT NULL,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  source_paths TEXT NOT NULL,
  generated_by TEXT,
  generator_version TEXT,
  created_at TEXT NOT NULL,
  provenance TEXT,
  metadata TEXT
);
CREATE INDEX idx_artifacts_revision ON artifacts(revision_id);
CREATE INDEX idx_artifacts_sha256 ON artifacts(sha256);

CREATE TABLE change_intents (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  base_revision_id TEXT NOT NULL REFERENCES revisions(id),
  target_branch TEXT NOT NULL,
  title TEXT NOT NULL,
  request_text TEXT,
  change_type TEXT NOT NULL,
  requested_operations TEXT NOT NULL,
  expected_object_changes TEXT NOT NULL,
  preserve TEXT NOT NULL,
  optimize TEXT NOT NULL,
  constraints TEXT NOT NULL,
  approval_policy TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'captured'
    CHECK (status IN ('captured','planned','executing','generated','validating','validated','review','accepted','rejected','failed','cancelled')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  metadata TEXT
);
CREATE INDEX idx_ci_project ON change_intents(project_id);

CREATE TABLE validation_results (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  revision_id TEXT NOT NULL REFERENCES revisions(id),
  change_intent_id TEXT,
  validator TEXT NOT NULL,
  validator_version TEXT NOT NULL,
  validation_type TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('pass','warning','fail','error','unknown','skipped')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,
  diagnostics TEXT NOT NULL,
  metrics TEXT,
  artifact_ids TEXT NOT NULL,
  environment TEXT,
  input_hash TEXT,
  created_at TEXT NOT NULL,
  metadata TEXT
);
CREATE INDEX idx_vr_revision ON validation_results(revision_id);

CREATE TABLE modules (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  source_project_id TEXT,
  source_revision_id TEXT,
  interfaces TEXT NOT NULL,
  requirements TEXT NOT NULL,
  constraints TEXT NOT NULL,
  dependencies TEXT NOT NULL,
  artifact_ids TEXT NOT NULL,
  bom_item_ids TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  license TEXT,
  maintainers TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  metadata TEXT
);
CREATE UNIQUE INDEX idx_modules_nsv ON modules(namespace, name, version);

CREATE TABLE engineering_pull_requests (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  base_branch TEXT NOT NULL,
  base_revision_id TEXT NOT NULL REFERENCES revisions(id),
  head_branch TEXT NOT NULL,
  head_revision_id TEXT NOT NULL REFERENCES revisions(id),
  change_intent_id TEXT,
  author TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','open','changes_requested','approved','merged','closed','rejected')),
  review_state TEXT,
  required_approvals INTEGER NOT NULL DEFAULT 1,
  approvals TEXT NOT NULL,
  change_requests TEXT NOT NULL,
  diff_summary TEXT,
  validation_summary TEXT,
  constraint_summary TEXT,
  merge_eligibility TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  merged_at TEXT,
  merged_revision_id TEXT,
  metadata TEXT
);
CREATE INDEX idx_epr_project ON engineering_pull_requests(project_id);
CREATE UNIQUE INDEX idx_epr_number ON engineering_pull_requests(project_id, number);
`;
