CREATE TABLE IF NOT EXISTS interaction_events (
  artifact_id String,
  creator_id String,
  session_id String,
  interaction_tempo Float64,
  hesitation_ms UInt32,
  replay_count UInt32,
  timestamp DateTime64(3)
) ENGINE = MergeTree ORDER BY (artifact_id, timestamp);

CREATE TABLE IF NOT EXISTS mutation_events (
  artifact_id String,
  parent_artifact_id String,
  mutation_type String,
  constraint_profile String,
  timestamp DateTime64(3)
) ENGINE = MergeTree ORDER BY (artifact_id, timestamp);

CREATE TABLE IF NOT EXISTS replay_events (
  artifact_id String,
  runtime_hash String,
  frame_hash String,
  deterministic UInt8,
  timestamp DateTime64(3)
) ENGINE = MergeTree ORDER BY (artifact_id, timestamp);
