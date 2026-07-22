import type Database from 'better-sqlite3';
import {
  EngineeringPullRequestSchema, PullRequestTransitions,
  type EngineeringPullRequest, type PRStatus, type ReviewRecord,
} from '@logichub-engineering/contracts';
import { createLogicHubError, transitionOrThrow, type EngineeringPullRequestId, type ProjectId } from '@logichub-engineering/shared';
import type { EngineeringPullRequestRepository } from './interfaces.js';
import { toJson, fromJsonRequired, fromJson } from '../serialization/json-column.js';

const TERMINAL_STATES: readonly PRStatus[] = ['merged', 'closed', 'rejected'];

interface EPRRow {
  id: string; schema_version: string; project_id: string; number: number;
  title: string; description: string | null; base_branch: string;
  base_revision_id: string; head_branch: string; head_revision_id: string;
  change_intent_id: string | null; author: string; status: string;
  review_state: string | null; required_approvals: number;
  approvals: string; change_requests: string; diff_summary: string | null;
  validation_summary: string | null; constraint_summary: string | null;
  merge_eligibility: string | null; created_at: string; updated_at: string | null;
  merged_at: string | null; merged_revision_id: string | null; metadata: string | null;
}

function rowToDomain(row: EPRRow): EngineeringPullRequest {
  return EngineeringPullRequestSchema.parse({
    id: row.id, schemaVersion: row.schema_version, projectId: row.project_id,
    number: row.number, title: row.title, description: row.description ?? undefined,
    baseBranch: row.base_branch, baseRevisionId: row.base_revision_id,
    headBranch: row.head_branch, headRevisionId: row.head_revision_id,
    changeIntentId: row.change_intent_id ?? undefined, author: row.author,
    status: row.status, reviewState: row.review_state ?? undefined,
    requiredApprovals: row.required_approvals,
    approvals: fromJsonRequired(row.approvals),
    changeRequests: fromJsonRequired(row.change_requests),
    diffSummary: fromJson(row.diff_summary),
    validationSummary: fromJson(row.validation_summary),
    constraintSummary: fromJson(row.constraint_summary),
    mergeEligibility: fromJson(row.merge_eligibility),
    createdAt: row.created_at, updatedAt: row.updated_at ?? undefined,
    mergedAt: row.merged_at ?? undefined,
    mergedRevisionId: row.merged_revision_id ?? undefined,
    metadata: fromJson(row.metadata),
  });
}

export class SqliteEngineeringPullRequestRepository implements EngineeringPullRequestRepository {
  private readonly insertStmt;
  private readonly findByIdStmt;
  private readonly findByProjectStmt;
  private readonly findByNumberStmt;
  private readonly updateStatusStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO engineering_pull_requests (id, schema_version, project_id, number, title,
        description, base_branch, base_revision_id, head_branch, head_revision_id,
        change_intent_id, author, status, review_state, required_approvals,
        approvals, change_requests, diff_summary, validation_summary,
        constraint_summary, merge_eligibility, created_at, updated_at,
        merged_at, merged_revision_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.findByIdStmt = db.prepare('SELECT * FROM engineering_pull_requests WHERE id = ?');
    this.findByProjectStmt = db.prepare('SELECT * FROM engineering_pull_requests WHERE project_id = ?');
    this.findByNumberStmt = db.prepare('SELECT * FROM engineering_pull_requests WHERE project_id = ? AND number = ?');
    this.updateStatusStmt = db.prepare('UPDATE engineering_pull_requests SET status = ? WHERE id = ?');
  }

  async create(pr: EngineeringPullRequest): Promise<void> {
    const p = EngineeringPullRequestSchema.parse(pr);
    this.insertStmt.run(
      p.id, p.schemaVersion, p.projectId, p.number, p.title,
      p.description ?? null, p.baseBranch, p.baseRevisionId,
      p.headBranch, p.headRevisionId, p.changeIntentId ?? null,
      p.author, p.status, p.reviewState ?? null, p.requiredApprovals,
      toJson(p.approvals), toJson(p.changeRequests),
      p.diffSummary ? toJson(p.diffSummary) : null,
      p.validationSummary ? toJson(p.validationSummary) : null,
      p.constraintSummary ? toJson(p.constraintSummary) : null,
      p.mergeEligibility ? toJson(p.mergeEligibility) : null,
      p.createdAt, p.updatedAt ?? null, p.mergedAt ?? null,
      p.mergedRevisionId ?? null, p.metadata ? toJson(p.metadata) : null,
    );
  }

  async findById(id: EngineeringPullRequestId): Promise<EngineeringPullRequest | null> {
    const row = this.findByIdStmt.get(id) as EPRRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByProjectId(projectId: ProjectId): Promise<EngineeringPullRequest[]> {
    return (this.findByProjectStmt.all(projectId) as EPRRow[]).map(rowToDomain);
  }

  async findByNumber(projectId: ProjectId, number: number): Promise<EngineeringPullRequest | null> {
    const row = this.findByNumberStmt.get(projectId, number) as EPRRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async updateStatus(id: EngineeringPullRequestId, newStatus: PRStatus): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw createLogicHubError('LH_REVISION_NOT_FOUND', `PR ${id} not found`, { entityIds: { pullRequestId: id } });

    if (TERMINAL_STATES.includes(existing.status as PRStatus)) {
      throw createLogicHubError('LH_STATE_TRANSITION_INVALID',
        `PR ${id} is in terminal state '${existing.status}'`,
        { entityIds: { pullRequestId: id } });
    }

    transitionOrThrow(existing.status as PRStatus, newStatus, PullRequestTransitions, 'PullRequest');
    this.updateStatusStmt.run(newStatus, id);
  }

  async updateComputedFields(id: EngineeringPullRequestId, fields: Partial<Pick<EngineeringPullRequest,
    'diffSummary' | 'validationSummary' | 'constraintSummary' | 'mergeEligibility' |
    'updatedAt' | 'mergedAt' | 'mergedRevisionId' | 'metadata'
  >>): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (fields.diffSummary !== undefined) { sets.push('diff_summary = ?'); values.push(toJson(fields.diffSummary)); }
    if (fields.validationSummary !== undefined) { sets.push('validation_summary = ?'); values.push(toJson(fields.validationSummary)); }
    if (fields.constraintSummary !== undefined) { sets.push('constraint_summary = ?'); values.push(toJson(fields.constraintSummary)); }
    if (fields.mergeEligibility !== undefined) { sets.push('merge_eligibility = ?'); values.push(toJson(fields.mergeEligibility)); }
    if (fields.updatedAt !== undefined) { sets.push('updated_at = ?'); values.push(fields.updatedAt); }
    if (fields.mergedAt !== undefined) { sets.push('merged_at = ?'); values.push(fields.mergedAt); }
    if (fields.mergedRevisionId !== undefined) { sets.push('merged_revision_id = ?'); values.push(fields.mergedRevisionId); }
    if (fields.metadata !== undefined) { sets.push('metadata = ?'); values.push(toJson(fields.metadata)); }
    if (sets.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE engineering_pull_requests SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  async addApproval(id: EngineeringPullRequestId, review: ReviewRecord): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw createLogicHubError('LH_REVISION_NOT_FOUND', `PR ${id} not found`, { entityIds: { pullRequestId: id } });
    const approvals = [...existing.approvals, review];
    this.db.prepare('UPDATE engineering_pull_requests SET approvals = ? WHERE id = ?').run(toJson(approvals), id);
  }

  async addChangeRequest(id: EngineeringPullRequestId, review: ReviewRecord): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw createLogicHubError('LH_REVISION_NOT_FOUND', `PR ${id} not found`, { entityIds: { pullRequestId: id } });
    const changeRequests = [...existing.changeRequests, review];
    this.db.prepare('UPDATE engineering_pull_requests SET change_requests = ? WHERE id = ?').run(toJson(changeRequests), id);
  }
}
