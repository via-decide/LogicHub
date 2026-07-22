import type Database from 'better-sqlite3';
import { ChangeIntentSchema, ChangeIntentTransitions, type ChangeIntent, type ChangeIntentStatus } from '@logichub-engineering/contracts';
import { createLogicHubError, transitionOrThrow, type ChangeIntentId, type ProjectId } from '@logichub-engineering/shared';
import type { ChangeIntentRepository } from './interfaces.js';
import { toJson, fromJsonRequired, fromJson } from '../serialization/json-column.js';

const TERMINAL_STATES: readonly ChangeIntentStatus[] = ['accepted', 'rejected', 'failed', 'cancelled'];

interface CIRow {
  id: string; schema_version: string; project_id: string; base_revision_id: string;
  target_branch: string; title: string; request_text: string | null;
  change_type: string; requested_operations: string; expected_object_changes: string;
  preserve: string; optimize: string; constraints: string; approval_policy: string;
  status: string; created_by: string; created_at: string;
  updated_at: string | null; metadata: string | null;
}

function rowToDomain(row: CIRow): ChangeIntent {
  return ChangeIntentSchema.parse({
    id: row.id, schemaVersion: row.schema_version, projectId: row.project_id,
    baseRevisionId: row.base_revision_id, targetBranch: row.target_branch,
    title: row.title, requestText: row.request_text ?? undefined,
    changeType: row.change_type,
    requestedOperations: fromJsonRequired(row.requested_operations),
    expectedObjectChanges: fromJsonRequired(row.expected_object_changes),
    preserve: fromJsonRequired(row.preserve), optimize: fromJsonRequired(row.optimize),
    constraints: fromJsonRequired(row.constraints),
    approvalPolicy: fromJsonRequired(row.approval_policy),
    status: row.status, createdBy: row.created_by, createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined, metadata: fromJson(row.metadata),
  });
}

export class SqliteChangeIntentRepository implements ChangeIntentRepository {
  private readonly insertStmt;
  private readonly findByIdStmt;
  private readonly findByProjectStmt;
  private readonly updateStatusStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO change_intents (id, schema_version, project_id, base_revision_id,
        target_branch, title, request_text, change_type, requested_operations,
        expected_object_changes, preserve, optimize, constraints, approval_policy,
        status, created_by, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.findByIdStmt = db.prepare('SELECT * FROM change_intents WHERE id = ?');
    this.findByProjectStmt = db.prepare('SELECT * FROM change_intents WHERE project_id = ?');
    this.updateStatusStmt = db.prepare('UPDATE change_intents SET status = ? WHERE id = ?');
  }

  async create(intent: ChangeIntent): Promise<void> {
    const c = ChangeIntentSchema.parse(intent);
    this.insertStmt.run(
      c.id, c.schemaVersion, c.projectId, c.baseRevisionId, c.targetBranch,
      c.title, c.requestText ?? null, c.changeType,
      toJson(c.requestedOperations), toJson(c.expectedObjectChanges),
      toJson(c.preserve), toJson(c.optimize), toJson(c.constraints),
      toJson(c.approvalPolicy), c.status, c.createdBy, c.createdAt,
      c.updatedAt ?? null, c.metadata ? toJson(c.metadata) : null,
    );
  }

  async findById(id: ChangeIntentId): Promise<ChangeIntent | null> {
    const row = this.findByIdStmt.get(id) as CIRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByProjectId(projectId: ProjectId): Promise<ChangeIntent[]> {
    return (this.findByProjectStmt.all(projectId) as CIRow[]).map(rowToDomain);
  }

  async updateStatus(id: ChangeIntentId, newStatus: ChangeIntentStatus): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw createLogicHubError('LH_REVISION_NOT_FOUND', `ChangeIntent ${id} not found`, { entityIds: { changeIntentId: id } });

    if (TERMINAL_STATES.includes(existing.status as ChangeIntentStatus)) {
      throw createLogicHubError('LH_STATE_TRANSITION_INVALID',
        `ChangeIntent ${id} is in terminal state '${existing.status}'`,
        { entityIds: { changeIntentId: id } });
    }

    transitionOrThrow(existing.status as ChangeIntentStatus, newStatus, ChangeIntentTransitions, 'ChangeIntent');
    this.updateStatusStmt.run(newStatus, id);
  }
}
