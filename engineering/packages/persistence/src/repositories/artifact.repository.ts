import type Database from 'better-sqlite3';
import { ArtifactSchema, type Artifact } from '@logichub-engineering/contracts';
import type { ArtifactId, RevisionId } from '@logichub-engineering/shared';
import type { ArtifactRepository } from './interfaces.js';
import { toJson, fromJsonRequired, fromJson } from '../serialization/json-column.js';

interface ArtifactRow {
  id: string; schema_version: string; project_id: string; revision_id: string;
  role: string; filename: string; media_type: string; byte_size: number;
  sha256: string; storage_key: string; source_paths: string;
  generated_by: string | null; generator_version: string | null;
  created_at: string; provenance: string | null; metadata: string | null;
}

function rowToDomain(row: ArtifactRow): Artifact {
  return ArtifactSchema.parse({
    id: row.id, schemaVersion: row.schema_version, projectId: row.project_id,
    revisionId: row.revision_id, role: row.role, filename: row.filename,
    mediaType: row.media_type, byteSize: row.byte_size, sha256: row.sha256,
    storageKey: row.storage_key, sourcePaths: fromJsonRequired(row.source_paths),
    generatedBy: row.generated_by ?? undefined,
    generatorVersion: row.generator_version ?? undefined,
    createdAt: row.created_at, provenance: fromJson(row.provenance),
    metadata: fromJson(row.metadata),
  });
}

export class SqliteArtifactRepository implements ArtifactRepository {
  private readonly insertStmt;
  private readonly findByIdStmt;
  private readonly findByRevisionStmt;
  private readonly findBySha256Stmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO artifacts (id, schema_version, project_id, revision_id, role, filename,
        media_type, byte_size, sha256, storage_key, source_paths, generated_by,
        generator_version, created_at, provenance, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.findByIdStmt = db.prepare('SELECT * FROM artifacts WHERE id = ?');
    this.findByRevisionStmt = db.prepare('SELECT * FROM artifacts WHERE revision_id = ?');
    this.findBySha256Stmt = db.prepare('SELECT * FROM artifacts WHERE sha256 = ?');
  }

  async create(artifact: Artifact): Promise<void> {
    const a = ArtifactSchema.parse(artifact);
    this.insertStmt.run(
      a.id, a.schemaVersion, a.projectId, a.revisionId, a.role, a.filename,
      a.mediaType, a.byteSize, a.sha256, a.storageKey,
      toJson(a.sourcePaths), a.generatedBy ?? null, a.generatorVersion ?? null,
      a.createdAt, a.provenance ? toJson(a.provenance) : null,
      a.metadata ? toJson(a.metadata) : null,
    );
  }

  async findById(id: ArtifactId): Promise<Artifact | null> {
    const row = this.findByIdStmt.get(id) as ArtifactRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByRevisionId(revisionId: RevisionId): Promise<Artifact[]> {
    return (this.findByRevisionStmt.all(revisionId) as ArtifactRow[]).map(rowToDomain);
  }

  async findBySha256(sha256: string): Promise<Artifact[]> {
    return (this.findBySha256Stmt.all(sha256) as ArtifactRow[]).map(rowToDomain);
  }
}
