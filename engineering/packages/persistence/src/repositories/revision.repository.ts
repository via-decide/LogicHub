import type Database from 'better-sqlite3';
import { RevisionSchema, RevisionTransitions, type Revision, type RevisionStatus } from '@logichub-engineering/contracts';
import { createLogicHubError, transitionOrThrow, type RevisionId, type ProjectId } from '@logichub-engineering/shared';
import type { RevisionRepository } from './interfaces.js';
import { toJson, fromJsonRequired, fromJson } from '../serialization/json-column.js';

const TERMINAL_STATES: readonly RevisionStatus[] = ['merged', 'rejected', 'failed'];

interface RevisionRow {
  id: string; schema_version: string; project_id: string; git_commit_sha: string;
  branch_name: string; parent_revision_ids: string; author: string; message: string;
  created_at: string; snapshot_hash: string | null;
  engineering_object_snapshot_hash: string | null; constraint_snapshot_hash: string | null;
  decision_snapshot_hash: string | null; bom_snapshot_hash: string | null;
  artifact_manifest_hash: string | null; toolchain: string; status: string;
  metadata: string | null;
}

function rowToDomain(row: RevisionRow): Revision {
  return RevisionSchema.parse({
    id: row.id,
    schemaVersion: row.schema_version,
    projectId: row.project_id,
    gitCommitSha: row.git_commit_sha,
    branchName: row.branch_name,
    parentRevisionIds: fromJsonRequired<string[]>(row.parent_revision_ids),
    author: row.author,
    message: row.message,
    createdAt: row.created_at,
    snapshotHash: row.snapshot_hash ?? undefined,
    engineeringObjectSnapshotHash: row.engineering_object_snapshot_hash ?? undefined,
    constraintSnapshotHash: row.constraint_snapshot_hash ?? undefined,
    decisionSnapshotHash: row.decision_snapshot_hash ?? undefined,
    bomSnapshotHash: row.bom_snapshot_hash ?? undefined,
    artifactManifestHash: row.artifact_manifest_hash ?? undefined,
    toolchain: fromJsonRequired<Record<string, string>>(row.toolchain),
    status: row.status,
    metadata: fromJson(row.metadata),
  });
}

export class SqliteRevisionRepository implements RevisionRepository {
  private readonly insertStmt;
  private readonly findByIdStmt;
  private readonly findByProjectStmt;
  private readonly findByShaStmt;
  private readonly findByBranchStmt;
  private readonly updateStatusStmt;
  private readonly setHashesStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO revisions (id, schema_version, project_id, git_commit_sha, branch_name,
        parent_revision_ids, author, message, created_at, snapshot_hash,
        engineering_object_snapshot_hash, constraint_snapshot_hash, decision_snapshot_hash,
        bom_snapshot_hash, artifact_manifest_hash, toolchain, status, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.findByIdStmt = db.prepare('SELECT * FROM revisions WHERE id = ?');
    this.findByProjectStmt = db.prepare('SELECT * FROM revisions WHERE project_id = ?');
    this.findByShaStmt = db.prepare('SELECT * FROM revisions WHERE project_id = ? AND git_commit_sha = ?');
    this.findByBranchStmt = db.prepare('SELECT * FROM revisions WHERE project_id = ? AND branch_name = ?');
    this.updateStatusStmt = db.prepare('UPDATE revisions SET status = ? WHERE id = ?');
    this.setHashesStmt = db.prepare(`
      UPDATE revisions SET snapshot_hash = ?, engineering_object_snapshot_hash = ?,
        constraint_snapshot_hash = ?, decision_snapshot_hash = ?,
        bom_snapshot_hash = ?, artifact_manifest_hash = ?
      WHERE id = ?
    `);
  }

  async create(revision: Revision): Promise<void> {
    const r = RevisionSchema.parse(revision);
    this.insertStmt.run(
      r.id, r.schemaVersion, r.projectId, r.gitCommitSha, r.branchName,
      toJson(r.parentRevisionIds), r.author, r.message, r.createdAt,
      r.snapshotHash ?? null, r.engineeringObjectSnapshotHash ?? null,
      r.constraintSnapshotHash ?? null, r.decisionSnapshotHash ?? null,
      r.bomSnapshotHash ?? null, r.artifactManifestHash ?? null,
      toJson(r.toolchain), r.status, r.metadata ? toJson(r.metadata) : null,
    );
  }

  async findById(id: RevisionId): Promise<Revision | null> {
    const row = this.findByIdStmt.get(id) as RevisionRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByProjectId(projectId: ProjectId): Promise<Revision[]> {
    return (this.findByProjectStmt.all(projectId) as RevisionRow[]).map(rowToDomain);
  }

  async findByGitCommitSha(projectId: ProjectId, sha: string): Promise<Revision | null> {
    const row = this.findByShaStmt.get(projectId, sha) as RevisionRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByBranch(projectId: ProjectId, branchName: string): Promise<Revision[]> {
    return (this.findByBranchStmt.all(projectId, branchName) as RevisionRow[]).map(rowToDomain);
  }

  async updateStatus(id: RevisionId, newStatus: RevisionStatus): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw createLogicHubError('LH_REVISION_NOT_FOUND', `Revision ${id} not found`, { entityIds: { revisionId: id } });

    if (TERMINAL_STATES.includes(existing.status as RevisionStatus)) {
      throw createLogicHubError('LH_REVISION_IMMUTABLE',
        `Revision ${id} is in terminal state '${existing.status}'`,
        { entityIds: { revisionId: id } });
    }

    transitionOrThrow(existing.status as RevisionStatus, newStatus, RevisionTransitions, 'Revision');
    this.updateStatusStmt.run(newStatus, id);
  }

  async setSnapshotHashes(id: RevisionId, hashes: {
    snapshotHash: string; engineeringObjectSnapshotHash: string;
    constraintSnapshotHash: string; decisionSnapshotHash: string;
    bomSnapshotHash: string; artifactManifestHash: string;
  }): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw createLogicHubError('LH_REVISION_NOT_FOUND', `Revision ${id} not found`, { entityIds: { revisionId: id } });

    if (!['draft', 'imported'].includes(existing.status)) {
      throw createLogicHubError('LH_REVISION_IMMUTABLE',
        `Cannot set snapshot hashes on revision in '${existing.status}' state`,
        { entityIds: { revisionId: id } });
    }

    this.setHashesStmt.run(
      hashes.snapshotHash, hashes.engineeringObjectSnapshotHash,
      hashes.constraintSnapshotHash, hashes.decisionSnapshotHash,
      hashes.bomSnapshotHash, hashes.artifactManifestHash, id,
    );
  }
}
