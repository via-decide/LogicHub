import type Database from 'better-sqlite3';
import { ValidationResultSchema, type ValidationResult } from '@logichub-engineering/contracts';
import type { ValidationResultId, RevisionId } from '@logichub-engineering/shared';
import type { ValidationResultRepository } from './interfaces.js';
import { toJson, fromJsonRequired, fromJson } from '../serialization/json-column.js';

interface VRRow {
  id: string; schema_version: string; project_id: string; revision_id: string;
  change_intent_id: string | null; validator: string; validator_version: string;
  validation_type: string; status: string; started_at: string;
  completed_at: string | null; duration_ms: number | null; diagnostics: string;
  metrics: string | null; artifact_ids: string; environment: string | null;
  input_hash: string | null; created_at: string; metadata: string | null;
}

function rowToDomain(row: VRRow): ValidationResult {
  return ValidationResultSchema.parse({
    id: row.id, schemaVersion: row.schema_version, projectId: row.project_id,
    revisionId: row.revision_id, changeIntentId: row.change_intent_id ?? undefined,
    validator: row.validator, validatorVersion: row.validator_version,
    validationType: row.validation_type, status: row.status,
    startedAt: row.started_at, completedAt: row.completed_at ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    diagnostics: fromJsonRequired(row.diagnostics),
    metrics: fromJson(row.metrics),
    artifactIds: fromJsonRequired(row.artifact_ids),
    environment: fromJson(row.environment),
    inputHash: row.input_hash ?? undefined, createdAt: row.created_at,
    metadata: fromJson(row.metadata),
  });
}

export class SqliteValidationResultRepository implements ValidationResultRepository {
  private readonly insertStmt;
  private readonly findByIdStmt;
  private readonly findByRevisionStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO validation_results (id, schema_version, project_id, revision_id,
        change_intent_id, validator, validator_version, validation_type, status,
        started_at, completed_at, duration_ms, diagnostics, metrics, artifact_ids,
        environment, input_hash, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.findByIdStmt = db.prepare('SELECT * FROM validation_results WHERE id = ?');
    this.findByRevisionStmt = db.prepare('SELECT * FROM validation_results WHERE revision_id = ?');
  }

  async create(result: ValidationResult): Promise<void> {
    const v = ValidationResultSchema.parse(result);
    this.insertStmt.run(
      v.id, v.schemaVersion, v.projectId, v.revisionId,
      v.changeIntentId ?? null, v.validator, v.validatorVersion,
      v.validationType, v.status, v.startedAt, v.completedAt ?? null,
      v.durationMs ?? null, toJson(v.diagnostics),
      v.metrics ? toJson(v.metrics) : null, toJson(v.artifactIds),
      v.environment ? toJson(v.environment) : null, v.inputHash ?? null,
      v.createdAt, v.metadata ? toJson(v.metadata) : null,
    );
  }

  async findById(id: ValidationResultId): Promise<ValidationResult | null> {
    const row = this.findByIdStmt.get(id) as VRRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByRevisionId(revisionId: RevisionId): Promise<ValidationResult[]> {
    return (this.findByRevisionStmt.all(revisionId) as VRRow[]).map(rowToDomain);
  }
}
