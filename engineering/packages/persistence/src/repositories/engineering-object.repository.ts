import type Database from 'better-sqlite3';
import { EngineeringObjectSchema, type EngineeringObject } from '@logichub-engineering/contracts';
import type { EngineeringObjectId, RevisionId } from '@logichub-engineering/shared';
import type { EngineeringObjectRepository } from './interfaces.js';
import { toJson, fromJsonRequired, fromJson } from '../serialization/json-column.js';

interface EORow {
  id: string; schema_version: string; project_id: string; revision_id: string;
  object_type: string; source_path: string; source_object_id: string | null;
  name: string; semantic_key: string; properties: string; relationships: string;
  geometry: string | null; content_hash: string; semantic_hash: string;
  created_at: string; metadata: string | null;
}

function rowToDomain(row: EORow): EngineeringObject {
  return EngineeringObjectSchema.parse({
    id: row.id, schemaVersion: row.schema_version, projectId: row.project_id,
    revisionId: row.revision_id, objectType: row.object_type, sourcePath: row.source_path,
    sourceObjectId: row.source_object_id ?? undefined, name: row.name,
    semanticKey: row.semantic_key, properties: fromJsonRequired(row.properties),
    relationships: fromJsonRequired(row.relationships),
    geometry: fromJson(row.geometry), contentHash: row.content_hash,
    semanticHash: row.semantic_hash, createdAt: row.created_at,
    metadata: fromJson(row.metadata),
  });
}

const INSERT_SQL = `
  INSERT INTO engineering_objects (id, schema_version, project_id, revision_id, object_type,
    source_path, source_object_id, name, semantic_key, properties, relationships,
    geometry, content_hash, semantic_hash, created_at, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export class SqliteEngineeringObjectRepository implements EngineeringObjectRepository {
  private readonly insertStmt;
  private readonly findByIdStmt;
  private readonly findByRevisionStmt;
  private readonly findByKeyStmt;
  private readonly findByTypeStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(INSERT_SQL);
    this.findByIdStmt = db.prepare('SELECT * FROM engineering_objects WHERE id = ?');
    this.findByRevisionStmt = db.prepare('SELECT * FROM engineering_objects WHERE revision_id = ?');
    this.findByKeyStmt = db.prepare('SELECT * FROM engineering_objects WHERE revision_id = ? AND semantic_key = ?');
    this.findByTypeStmt = db.prepare('SELECT * FROM engineering_objects WHERE revision_id = ? AND object_type = ?');
  }

  private insertOne(obj: EngineeringObject): void {
    const o = EngineeringObjectSchema.parse(obj);
    this.insertStmt.run(
      o.id, o.schemaVersion, o.projectId, o.revisionId, o.objectType,
      o.sourcePath, o.sourceObjectId ?? null, o.name, o.semanticKey,
      toJson(o.properties), toJson(o.relationships),
      o.geometry ? toJson(o.geometry) : null, o.contentHash, o.semanticHash,
      o.createdAt, o.metadata ? toJson(o.metadata) : null,
    );
  }

  async create(obj: EngineeringObject): Promise<void> {
    this.insertOne(obj);
  }

  async createMany(objects: EngineeringObject[]): Promise<void> {
    const batch = this.db.transaction(() => {
      for (const obj of objects) this.insertOne(obj);
    });
    batch();
  }

  async findById(id: EngineeringObjectId): Promise<EngineeringObject | null> {
    const row = this.findByIdStmt.get(id) as EORow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByRevisionId(revisionId: RevisionId): Promise<EngineeringObject[]> {
    return (this.findByRevisionStmt.all(revisionId) as EORow[]).map(rowToDomain);
  }

  async findBySemanticKey(revisionId: RevisionId, semanticKey: string): Promise<EngineeringObject | null> {
    const row = this.findByKeyStmt.get(revisionId, semanticKey) as EORow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByType(revisionId: RevisionId, objectType: string): Promise<EngineeringObject[]> {
    return (this.findByTypeStmt.all(revisionId, objectType) as EORow[]).map(rowToDomain);
  }
}
