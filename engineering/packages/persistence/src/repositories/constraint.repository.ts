import type Database from 'better-sqlite3';
import { ConstraintSchema, type Constraint } from '@logichub-engineering/contracts';
import type { ConstraintId, RevisionId } from '@logichub-engineering/shared';
import type { ConstraintRepository } from './interfaces.js';
import { toJson, fromJson } from '../serialization/json-column.js';

interface ConstraintRow {
  id: string; schema_version: string; project_id: string; revision_id: string;
  name: string; description: string | null; category: string; severity: string;
  scope: string; target_object_ids: string; expression: string | null;
  unit: string | null; expected: string | null; source: string | null;
  status: string; evaluation: string; created_by: string; created_at: string;
  updated_at: string | null; metadata: string | null;
}

function rowToDomain(row: ConstraintRow): Constraint {
  return ConstraintSchema.parse({
    id: row.id, schemaVersion: row.schema_version, projectId: row.project_id,
    revisionId: row.revision_id, name: row.name,
    description: row.description ?? undefined, category: row.category,
    severity: row.severity, scope: row.scope,
    targetObjectIds: fromJson<string[]>(row.target_object_ids) ?? [],
    expression: fromJson(row.expression), unit: row.unit ?? undefined,
    expected: fromJson(row.expected), source: row.source ?? undefined,
    status: row.status, evaluation: row.evaluation, createdBy: row.created_by,
    createdAt: row.created_at, updatedAt: row.updated_at ?? undefined,
    metadata: fromJson(row.metadata),
  });
}

export class SqliteConstraintRepository implements ConstraintRepository {
  private readonly insertStmt;
  private readonly findByIdStmt;
  private readonly findByRevisionStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO constraints (id, schema_version, project_id, revision_id, name, description,
        category, severity, scope, target_object_ids, expression, unit, expected, source,
        status, evaluation, created_by, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.findByIdStmt = db.prepare('SELECT * FROM constraints WHERE id = ?');
    this.findByRevisionStmt = db.prepare('SELECT * FROM constraints WHERE revision_id = ?');
  }

  async create(constraint: Constraint): Promise<void> {
    const c = ConstraintSchema.parse(constraint);
    this.insertStmt.run(
      c.id, c.schemaVersion, c.projectId, c.revisionId, c.name,
      c.description ?? null, c.category, c.severity, c.scope,
      toJson(c.targetObjectIds), c.expression != null ? toJson(c.expression) : null,
      c.unit ?? null, c.expected != null ? toJson(c.expected) : null,
      c.source ?? null, c.status, c.evaluation, c.createdBy, c.createdAt,
      c.updatedAt ?? null, c.metadata ? toJson(c.metadata) : null,
    );
  }

  async findById(id: ConstraintId): Promise<Constraint | null> {
    const row = this.findByIdStmt.get(id) as ConstraintRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByRevisionId(revisionId: RevisionId): Promise<Constraint[]> {
    return (this.findByRevisionStmt.all(revisionId) as ConstraintRow[]).map(rowToDomain);
  }

  async update(id: ConstraintId, fields: Partial<Pick<Constraint, 'evaluation' | 'status' | 'updatedAt' | 'metadata'>>): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (fields.evaluation !== undefined) { sets.push('evaluation = ?'); values.push(fields.evaluation); }
    if (fields.status !== undefined) { sets.push('status = ?'); values.push(fields.status); }
    if (fields.updatedAt !== undefined) { sets.push('updated_at = ?'); values.push(fields.updatedAt); }
    if (fields.metadata !== undefined) { sets.push('metadata = ?'); values.push(toJson(fields.metadata)); }
    if (sets.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE constraints SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }
  }
}
