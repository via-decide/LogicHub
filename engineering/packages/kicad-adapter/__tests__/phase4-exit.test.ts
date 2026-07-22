import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  createDatabase, runMigrations,
  SqliteProjectRepository, SqliteRevisionRepository,
  SqliteEngineeringObjectRepository, SqliteValidationResultRepository,
  SqliteArtifactRepository,
  computeSnapshotHashes,
} from '@logichub-engineering/persistence';
import { LocalArtifactStore } from '@logichub-engineering/artifact-store';
import { KicadAdapter } from '../src/operations.js';
import { inspectProject } from '../src/project-inspector.js';
import { parseSchematic } from '../src/extractors/schematic-extractor.js';
import { parsePcb } from '../src/extractors/pcb-extractor.js';
import { extractBom } from '../src/extractors/bom-extractor.js';
import {
  schematicToObjects, pcbToObjects, bomToObjects,
  sha256Hex,
  type ExtractionContext,
} from '../src/extractors/engineering-objects.js';
import { collectToolMetadata } from '../src/toolchain.js';
import { ToolExecutor } from '../src/kicad-executor.js';
import type { EngineeringObject } from '@logichub-engineering/contracts';

const FIXTURE_BASE = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/base');
const FIXTURE_PROPOSED = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/proposed');
const NOW = '2025-01-20T12:00:00.000Z';

describe('Phase 4 exit condition: fixture projects import and generate evidence', () => {
  let db: ReturnType<typeof createDatabase>;
  let projectRepo: SqliteProjectRepository;
  let revisionRepo: SqliteRevisionRepository;
  let objectRepo: SqliteEngineeringObjectRepository;
  let validationRepo: SqliteValidationResultRepository;
  let artifactRepo: SqliteArtifactRepository;
  let artifactStore: LocalArtifactStore;
  let adapter: KicadAdapter;

  beforeAll(async () => {
    db = createDatabase({ path: ':memory:' });
    runMigrations(db);
    projectRepo = new SqliteProjectRepository(db);
    revisionRepo = new SqliteRevisionRepository(db);
    objectRepo = new SqliteEngineeringObjectRepository(db);
    validationRepo = new SqliteValidationResultRepository(db);
    artifactRepo = new SqliteArtifactRepository(db);

    const storeDir = await mkdtemp(join(tmpdir(), 'logichub-artifacts-'));
    artifactStore = new LocalArtifactStore(storeDir);

    adapter = new KicadAdapter({ timeoutMs: 60_000 });

    await projectRepo.create({
      id: 'proj-kicad-1',
      schemaVersion: '0.1.0',
      slug: 'smart-plant-pot',
      name: 'Smart Plant Pot',
      visibility: 'private',
      repository: { provider: 'local', localPath: FIXTURE_BASE, defaultBranch: 'main' },
      defaultBranch: 'main',
      createdBy: 'test-user',
      createdAt: NOW,
      status: 'active',
      metadata: undefined,
    });
  });

  it('parses, validates, and extracts from base fixture', async () => {
    const files = await inspectProject(FIXTURE_BASE);
    expect(files.schematicFile).not.toBeNull();
    expect(files.pcbFile).not.toBeNull();

    const validation = await adapter.validateProjectFiles(files);
    expect(validation.valid).toBe(true);

    const ctx: ExtractionContext = {
      projectId: 'proj-kicad-1',
      revisionId: 'rev-base-1',
      createdAt: NOW,
    };

    const schObjects = await adapter.extractSchematicObjects(ctx, files.schematicFile!);
    const pcbObjects = await adapter.extractPcbObjects(ctx, files.pcbFile!);
    const { items: bomItems, objects: bomObjects } = await adapter.extractBom(ctx, files.schematicFile!);

    expect(schObjects.length).toBeGreaterThan(0);
    expect(pcbObjects.length).toBeGreaterThan(0);
    expect(bomItems.length).toBeGreaterThan(0);
    expect(bomObjects.length).toBeGreaterThan(0);

    const allObjects = [...schObjects, ...pcbObjects, ...bomObjects];

    for (const obj of allObjects) {
      expect(obj.id).toMatch(/^eo-[a-f0-9]{24}$/);
      expect(obj.contentHash).toHaveLength(64);
      expect(obj.semanticHash).toHaveLength(64);
      expect(obj.projectId).toBe('proj-kicad-1');
      expect(obj.revisionId).toBe('rev-base-1');
    }

    await revisionRepo.create({
      id: 'rev-base-1',
      schemaVersion: '0.1.0',
      projectId: 'proj-kicad-1',
      gitCommitSha: 'a'.repeat(40),
      branchName: 'main',
      parentRevisionIds: [],
      author: 'test-user',
      message: 'base import',
      createdAt: NOW,
      toolchain: { 'kicad-adapter': '0.1.0' },
      status: 'draft',
      metadata: undefined,
    });

    for (const obj of allObjects) {
      await objectRepo.create(obj);
    }

    const stored = await objectRepo.findByRevisionId('rev-base-1');
    expect(stored.length).toBe(allObjects.length);

    const hashes = computeSnapshotHashes({
      engineeringObjects: [...schObjects, ...pcbObjects],
      constraints: [],
      decisions: [],
      bomItems: bomObjects,
      artifacts: [],
    });
    expect(hashes.snapshotHash).toHaveLength(64);
    expect(hashes.engineeringObjectSnapshotHash).toHaveLength(64);

    await revisionRepo.setSnapshotHashes('rev-base-1', hashes);
  });

  it('parses, validates, and extracts from proposed fixture', async () => {
    const files = await inspectProject(FIXTURE_PROPOSED);
    expect(files.schematicFile).not.toBeNull();

    const validation = await adapter.validateProjectFiles(files);
    expect(validation.valid).toBe(true);

    const ctx: ExtractionContext = {
      projectId: 'proj-kicad-1',
      revisionId: 'rev-proposed-1',
      createdAt: NOW,
    };

    const schObjects = await adapter.extractSchematicObjects(ctx, files.schematicFile!);
    const pcbObjects = await adapter.extractPcbObjects(ctx, files.pcbFile!);
    const { items: bomItems, objects: bomObjects } = await adapter.extractBom(ctx, files.schematicFile!);

    const allObjects = [...schObjects, ...pcbObjects, ...bomObjects];
    expect(allObjects.length).toBeGreaterThan(0);

    await revisionRepo.create({
      id: 'rev-proposed-1',
      schemaVersion: '0.1.0',
      projectId: 'proj-kicad-1',
      gitCommitSha: 'b'.repeat(40),
      branchName: 'feature/proposed',
      parentRevisionIds: ['rev-base-1'],
      author: 'test-user',
      message: 'proposed changes',
      createdAt: NOW,
      toolchain: { 'kicad-adapter': '0.1.0' },
      status: 'draft',
      metadata: undefined,
    });

    for (const obj of allObjects) {
      await objectRepo.create(obj);
    }
  });

  it('base and proposed produce different snapshot hashes', async () => {
    const baseCtx: ExtractionContext = { projectId: 'proj-kicad-1', revisionId: 'rev-base-snap', createdAt: NOW };
    const propCtx: ExtractionContext = { projectId: 'proj-kicad-1', revisionId: 'rev-prop-snap', createdAt: NOW };

    const baseFiles = await inspectProject(FIXTURE_BASE);
    const propFiles = await inspectProject(FIXTURE_PROPOSED);

    const baseSch = await parseSchematic(baseFiles.schematicFile!);
    const propSch = await parseSchematic(propFiles.schematicFile!);

    const baseBom = extractBom(baseSch);
    const propBom = extractBom(propSch);

    const baseSchObjs = schematicToObjects(baseCtx, baseSch);
    const baseBomObjs = bomToObjects(baseCtx, baseFiles.schematicFile!, baseBom);
    const baseHash = computeSnapshotHashes({
      engineeringObjects: baseSchObjs,
      constraints: [],
      decisions: [],
      bomItems: baseBomObjs,
      artifacts: [],
    });

    const propSchObjs = schematicToObjects(propCtx, propSch);
    const propBomObjs = bomToObjects(propCtx, propFiles.schematicFile!, propBom);
    const propHash = computeSnapshotHashes({
      engineeringObjects: propSchObjs,
      constraints: [],
      decisions: [],
      bomItems: propBomObjs,
      artifacts: [],
    });

    expect(baseHash.snapshotHash).not.toBe(propHash.snapshotHash);
  });

  it('stores render evidence in artifact store when toolchain available', async () => {
    const executor = new ToolExecutor();
    const meta = await collectToolMetadata(executor);

    const files = await inspectProject(FIXTURE_BASE);

    if (meta.available && meta.supported) {
      const schRender = await adapter.renderSchematic(files);
      const putResult = await artifactStore.put(
        schRender.content,
        { mediaType: 'image/svg+xml', createdAt: NOW, filename: 'schematic.svg' },
      );
      expect(putResult.sha256).toHaveLength(64);

      await artifactRepo.create({
        id: 'art-render-1',
        schemaVersion: '0.1.0',
        projectId: 'proj-kicad-1',
        revisionId: 'rev-base-1',
        role: 'schematic_render',
        mediaType: 'image/svg+xml',
        filename: 'schematic.svg',
        storageKey: putResult.sha256,
        byteSize: putResult.byteSize,
        sha256: putResult.sha256,
        sourcePaths: ['smart-plant-pot.kicad_sch'],
        generatedBy: 'kicad-cli',
        createdAt: NOW,
        metadata: undefined,
      });

      const storedArtifact = await artifactRepo.findById('art-render-1');
      expect(storedArtifact).not.toBeNull();
      expect(storedArtifact!.sha256).toBe(putResult.sha256);

      const verified = await artifactStore.verify(putResult.sha256);
      expect(verified).toBe(true);
    }
  });

  it('records validation results', async () => {
    const files = await inspectProject(FIXTURE_BASE);
    const drcResult = await adapter.runDrc(files);
    const ercResult = await adapter.runErc(files);

    await validationRepo.create({
      id: 'val-import-1',
      schemaVersion: '0.1.0',
      projectId: 'proj-kicad-1',
      revisionId: 'rev-base-1',
      validator: 'kicad-adapter',
      validatorVersion: '0.1.0',
      validationType: 'kicad_import',
      status: 'pass',
      startedAt: NOW,
      completedAt: NOW,
      diagnostics: [],
      artifactIds: [],
      createdAt: NOW,
      metadata: undefined,
    });

    await validationRepo.create({
      id: 'val-drc-1',
      schemaVersion: '0.1.0',
      projectId: 'proj-kicad-1',
      revisionId: 'rev-base-1',
      validator: 'kicad-drc',
      validatorVersion: '0.1.0',
      validationType: 'drc',
      status: drcResult.status === 'skipped' ? 'skipped' : drcResult.status,
      startedAt: NOW,
      completedAt: NOW,
      diagnostics: drcResult.diagnostics.map(d => ({
        severity: d.severity,
        message: d.message,
        code: d.code,
      })),
      artifactIds: [],
      createdAt: NOW,
      metadata: undefined,
    });

    await validationRepo.create({
      id: 'val-erc-1',
      schemaVersion: '0.1.0',
      projectId: 'proj-kicad-1',
      revisionId: 'rev-base-1',
      validator: 'kicad-erc',
      validatorVersion: '0.1.0',
      validationType: 'erc',
      status: ercResult.status === 'skipped' ? 'skipped' : ercResult.status,
      startedAt: NOW,
      completedAt: NOW,
      diagnostics: ercResult.diagnostics.map(d => ({
        severity: d.severity,
        message: d.message,
        code: d.code,
      })),
      artifactIds: [],
      createdAt: NOW,
      metadata: undefined,
    });

    const allVals = await validationRepo.findByRevisionId('rev-base-1');
    expect(allVals.length).toBe(3);
    const types = allVals.map(v => v.validationType).sort();
    expect(types).toContain('kicad_import');
    expect(types).toContain('drc');
    expect(types).toContain('erc');
  });
});
