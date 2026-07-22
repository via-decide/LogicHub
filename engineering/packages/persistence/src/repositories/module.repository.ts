import type Database from 'better-sqlite3';
import { ModuleSchema, type Module } from '@logichub-engineering/contracts';
import type { ModuleId } from '@logichub-engineering/shared';
import type { ModuleRepository } from './interfaces.js';
import { toJson, fromJsonRequired, fromJson } from '../serialization/json-column.js';

interface ModuleRow {
  id: string; schema_version: string; namespace: string; name: string;
  version: string; description: string | null; source_project_id: string | null;
  source_revision_id: string | null; interfaces: string; requirements: string;
  constraints: string; dependencies: string; artifact_ids: string;
  bom_item_ids: string; verification_status: string; license: string | null;
  maintainers: string; created_at: string; published_at: string | null;
  metadata: string | null;
}

function rowToDomain(row: ModuleRow): Module {
  return ModuleSchema.parse({
    id: row.id, schemaVersion: row.schema_version, namespace: row.namespace,
    name: row.name, version: row.version,
    description: row.description ?? undefined,
    sourceProjectId: row.source_project_id ?? undefined,
    sourceRevisionId: row.source_revision_id ?? undefined,
    interfaces: fromJsonRequired(row.interfaces),
    requirements: fromJsonRequired(row.requirements),
    constraints: fromJsonRequired(row.constraints),
    dependencies: fromJsonRequired(row.dependencies),
    artifactIds: fromJsonRequired(row.artifact_ids),
    bomItemIds: fromJsonRequired(row.bom_item_ids),
    verificationStatus: row.verification_status,
    license: row.license ?? undefined,
    maintainers: fromJsonRequired(row.maintainers),
    createdAt: row.created_at, publishedAt: row.published_at ?? undefined,
    metadata: fromJson(row.metadata),
  });
}

export class SqliteModuleRepository implements ModuleRepository {
  private readonly insertStmt;
  private readonly findByIdStmt;
  private readonly findByNsNameStmt;
  private readonly listAllStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO modules (id, schema_version, namespace, name, version, description,
        source_project_id, source_revision_id, interfaces, requirements, constraints,
        dependencies, artifact_ids, bom_item_ids, verification_status, license,
        maintainers, created_at, published_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.findByIdStmt = db.prepare('SELECT * FROM modules WHERE id = ?');
    this.findByNsNameStmt = db.prepare('SELECT * FROM modules WHERE namespace = ? AND name = ?');
    this.listAllStmt = db.prepare('SELECT * FROM modules');
  }

  async create(mod: Module): Promise<void> {
    const m = ModuleSchema.parse(mod);
    this.insertStmt.run(
      m.id, m.schemaVersion, m.namespace, m.name, m.version,
      m.description ?? null, m.sourceProjectId ?? null,
      m.sourceRevisionId ?? null, toJson(m.interfaces),
      toJson(m.requirements), toJson(m.constraints), toJson(m.dependencies),
      toJson(m.artifactIds), toJson(m.bomItemIds), m.verificationStatus,
      m.license ?? null, toJson(m.maintainers), m.createdAt,
      m.publishedAt ?? null, m.metadata ? toJson(m.metadata) : null,
    );
  }

  async findById(id: ModuleId): Promise<Module | null> {
    const row = this.findByIdStmt.get(id) as ModuleRow | undefined;
    return row ? rowToDomain(row) : null;
  }

  async findByNamespaceAndName(namespace: string, name: string): Promise<Module[]> {
    return (this.findByNsNameStmt.all(namespace, name) as ModuleRow[]).map(rowToDomain);
  }

  async listAll(): Promise<Module[]> {
    return (this.listAllStmt.all() as ModuleRow[]).map(rowToDomain);
  }
}
