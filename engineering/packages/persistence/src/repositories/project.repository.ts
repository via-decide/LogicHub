import type Database from 'better-sqlite3';
import { ProjectSchema, type Project } from '@logichub-engineering/contracts';
import { createLogicHubError, type ProjectId } from '@logichub-engineering/shared';
import type { ProjectRepository } from './interfaces.js';
import { toJson, fromJsonRequired, fromJson } from '../serialization/json-column.js';

interface ProjectRow {
  id: string; schema_version: string; slug: string; name: string;
  description: string | null; visibility: string; repository: string;
  default_branch: string; created_by: string; created_at: string;
  updated_at: string | null; status: string; metadata: string | null;
}

function rowToDomain(row: ProjectRow): Project {
  return ProjectSchema.parse({
    id: row.id,
    schemaVersion: row.schema_version,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    visibility: row.visibility,
    repository: fromJsonRequired(row.repository),
    defaultBranch: row.default_branch,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    status: row.status,
    metadata: fromJson(row.metadata),
  });
}

export class SqliteProjectRepository implements ProjectRepository {
  private readonly insertStmt;
  private readonly findByIdStmt;
  private readonly findBySlugStmt;
  private readonly listAllStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO projects (id, schema_version, slug, name, description, visibility,
        repository, default_branch, created_by, created_at, updated_at, status, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.findByIdStmt = db.prepare('SELECT * FROM projects WHERE id = ?');
    this.findBySlugStmt = db.prepare('SELECT * FROM projects WHERE slug = ?');
    this.listAllStmt = db.prepare('SELECT * FROM projects');
  }

  async create(project: Project): Promise<void> {
    const p = ProjectSchema.parse(project);
    this.insertStmt.run(
      p.id, p.schemaVersion, p.slug, p.name, p.description ?? null,
      p.visibility, toJson(p.repository), p.defaultBranch, p.createdBy,
      p.createdAt, p.updatedAt ?? null, p.status, p.metadata ? toJson(p.metadata) : null,
    );
  }

  async findById(id: ProjectId): Promise<Project | null> {
    const row = this.findByIdStmt.get(id) as ProjectRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Project | null> {
    const row = this.findBySlugStmt.get(slug) as ProjectRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async listAll(): Promise<Project[]> {
    const rows = this.listAllStmt.all() as ProjectRow[];
    return rows.map(rowToDomain);
  }

  async update(id: ProjectId, fields: Partial<Pick<Project, 'name' | 'description' | 'status' | 'updatedAt' | 'metadata'>>): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw createLogicHubError('LH_PROJECT_NOT_FOUND', `Project ${id} not found`, { entityIds: { projectId: id } });

    const sets: string[] = [];
    const values: unknown[] = [];
    if (fields.name !== undefined) { sets.push('name = ?'); values.push(fields.name); }
    if (fields.description !== undefined) { sets.push('description = ?'); values.push(fields.description); }
    if (fields.status !== undefined) { sets.push('status = ?'); values.push(fields.status); }
    if (fields.updatedAt !== undefined) { sets.push('updated_at = ?'); values.push(fields.updatedAt); }
    if (fields.metadata !== undefined) { sets.push('metadata = ?'); values.push(toJson(fields.metadata)); }

    if (sets.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }
  }
}
