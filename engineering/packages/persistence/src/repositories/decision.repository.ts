import type Database from 'better-sqlite3';
import { DecisionSchema, type Decision } from '@logichub-engineering/contracts';
import type { DecisionId, RevisionId } from '@logichub-engineering/shared';
import type { DecisionRepository } from './interfaces.js';
import { toJson, fromJsonRequired, fromJson } from '../serialization/json-column.js';

interface DecisionRow {
  id: string; schema_version: string; project_id: string; revision_id: string;
  change_intent_id: string | null; question: string; context: string | null;
  alternatives: string; selected_alternative: string | null; rationale: string | null;
  tradeoffs: string | null; constraints_considered: string;
  evidence_artifact_ids: string; validation_result_ids: string;
  confidence: string | null; status: string; created_by: string;
  created_at: string; supersedes_decision_id: string | null; metadata: string | null;
}

function rowToDomain(row: DecisionRow): Decision {
  return DecisionSchema.parse({
    id: row.id, schemaVersion: row.schema_version, projectId: row.project_id,
    revisionId: row.revision_id, changeIntentId: row.change_intent_id ?? undefined,
    question: row.question, context: row.context ?? undefined,
    alternatives: fromJsonRequired(row.alternatives),
    selectedAlternative: row.selected_alternative ?? undefined,
    rationale: row.rationale ?? undefined, tradeoffs: row.tradeoffs ?? undefined,
    constraintsConsidered: fromJsonRequired(row.constraints_considered),
    evidenceArtifactIds: fromJsonRequired(row.evidence_artifact_ids),
    validationResultIds: fromJsonRequired(row.validation_result_ids),
    confidence: row.confidence ?? undefined, status: row.status,
    createdBy: row.created_by, createdAt: row.created_at,
    supersedesDecisionId: row.supersedes_decision_id ?? undefined,
    metadata: fromJson(row.metadata),
  });
}

export class SqliteDecisionRepository implements DecisionRepository {
  private readonly insertStmt;
  private readonly findByIdStmt;
  private readonly findByRevisionStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO decisions (id, schema_version, project_id, revision_id, change_intent_id,
        question, context, alternatives, selected_alternative, rationale, tradeoffs,
        constraints_considered, evidence_artifact_ids, validation_result_ids, confidence,
        status, created_by, created_at, supersedes_decision_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.findByIdStmt = db.prepare('SELECT * FROM decisions WHERE id = ?');
    this.findByRevisionStmt = db.prepare('SELECT * FROM decisions WHERE revision_id = ?');
  }

  async create(decision: Decision): Promise<void> {
    const d = DecisionSchema.parse(decision);
    this.insertStmt.run(
      d.id, d.schemaVersion, d.projectId, d.revisionId,
      d.changeIntentId ?? null, d.question, d.context ?? null,
      toJson(d.alternatives), d.selectedAlternative ?? null,
      d.rationale ?? null, d.tradeoffs ?? null,
      toJson(d.constraintsConsidered), toJson(d.evidenceArtifactIds),
      toJson(d.validationResultIds), d.confidence ?? null, d.status,
      d.createdBy, d.createdAt, d.supersedesDecisionId ?? null,
      d.metadata ? toJson(d.metadata) : null,
    );
  }

  async findById(id: DecisionId): Promise<Decision | null> {
    const row = this.findByIdStmt.get(id) as DecisionRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByRevisionId(revisionId: RevisionId): Promise<Decision[]> {
    return (this.findByRevisionStmt.all(revisionId) as DecisionRow[]).map(rowToDomain);
  }
}
