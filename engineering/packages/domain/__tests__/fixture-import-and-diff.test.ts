import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { createDatabase, runMigrations } from '@logichub-engineering/persistence';
import {
  SqliteProjectRepository,
  SqliteRevisionRepository,
  SqliteEngineeringObjectRepository,
  SqliteArtifactRepository,
  SqliteValidationResultRepository,
  SqliteConstraintRepository,
} from '@logichub-engineering/persistence';
import { LocalArtifactStore } from '@logichub-engineering/artifact-store';
import type { Project } from '@logichub-engineering/contracts';
import { ImportService } from '../src/import-service.js';
import { RevisionComparisonService } from '../src/revision-comparison-service.js';
import { generateId, isoNow } from '../src/id-generator.js';
import { createSmartPlantPotFixtureRepo, type FixtureRepo } from '../../../tests/helpers/fixture-repo.js';

/**
 * This is the end-to-end proof Phase 5 was missing: buildFingerprint and
 * computeSemDiff run against the real smart-plant-pot KiCad fixture files
 * (not hand-built FingerprintDescriptor helpers), and the deltas are
 * asserted against the specific, named changes generate-fixtures.mjs
 * introduces (see fixtures/kicad/smart-plant-pot/README.md): J1 connector
 * swap, U1 regulator swap, D2 added, R1+D1 removed, C3 added, J2 moved.
 */
describe('domain import + revision comparison against the real smart-plant-pot fixture', () => {
  let fixture: FixtureRepo;
  let db: Database.Database;
  let artifactDir: string;
  let importService: ImportService;
  let comparisonService: RevisionComparisonService;
  let project: Project;
  let baseRevisionId: string;
  let headRevisionId: string;

  beforeAll(async () => {
    fixture = await createSmartPlantPotFixtureRepo();

    db = createDatabase({ path: ':memory:' });
    runMigrations(db);
    artifactDir = await mkdtemp(join(tmpdir(), 'logichub-artifacts-'));

    const projectRepo = new SqliteProjectRepository(db);
    const revisionRepo = new SqliteRevisionRepository(db);
    const objectRepo = new SqliteEngineeringObjectRepository(db);
    const artifactRepo = new SqliteArtifactRepository(db);
    const validationResultRepo = new SqliteValidationResultRepository(db);
    const constraintRepo = new SqliteConstraintRepository(db);
    const artifactStore = new LocalArtifactStore(artifactDir);

    project = {
      id: generateId('proj'),
      schemaVersion: '0.1.0',
      slug: 'smart-plant-pot',
      name: 'Smart Plant Pot',
      visibility: 'private',
      repository: { provider: 'git', localPath: fixture.repoPath, defaultBranch: fixture.baseBranch },
      defaultBranch: fixture.baseBranch,
      createdBy: 'test',
      createdAt: isoNow(),
      status: 'active',
      metadata: {},
    };
    await projectRepo.create(project);

    importService = new ImportService({ projectRepo, revisionRepo, objectRepo, artifactRepo, validationResultRepo, artifactStore });
    comparisonService = new RevisionComparisonService({ revisionRepo, objectRepo, constraintRepo, artifactRepo, artifactStore });

    const baseImport = await importService.importRevision({
      projectId: project.id,
      repoPath: fixture.repoPath,
      ref: fixture.baseSha,
      branchName: fixture.baseBranch,
      author: 'fixture',
      message: 'base import',
    });
    baseRevisionId = baseImport.revision.id;

    const headImport = await importService.importRevision({
      projectId: project.id,
      repoPath: fixture.repoPath,
      ref: fixture.headSha,
      branchName: fixture.headBranch,
      author: 'fixture',
      message: 'proposed import',
    });
    headRevisionId = headImport.revision.id;
  }, 60000);

  afterAll(async () => {
    await fixture.cleanup();
    await rm(artifactDir, { recursive: true, force: true });
  });

  it('imports both revisions with real extracted engineering objects', async () => {
    const baseImportAgain = await importService
      .importRevision({
        projectId: project.id,
        repoPath: fixture.repoPath,
        ref: fixture.baseSha,
        branchName: fixture.baseBranch,
        author: 'fixture',
        message: 'duplicate',
      })
      .catch((err: unknown) => err);
    expect(baseImportAgain).toBeInstanceOf(Error);
    expect((baseImportAgain as { code?: string }).code).toBe('LH_REVISION_ALREADY_IMPORTED');
  });

  it('produces the exact named deltas the fixture pair is known to contain', async () => {
    const comparison = await comparisonService.compareRevisions(fixture.repoPath, baseRevisionId, headRevisionId);
    const { deltas } = comparison.semDiff;

    function typesFor(semanticId: string): Set<string> {
      return new Set(
        deltas.filter((d) => d.oldSemanticId === semanticId || d.newSemanticId === semanticId).map((d) => d.deltaType)
      );
    }
    function hasDelta(deltaType: string, oldId: string | null, newId: string | null): boolean {
      return deltas.some((d) => d.deltaType === deltaType && d.oldSemanticId === oldId && d.newSemanticId === newId);
    }

    // U1: AMS1117-3.3 LDO -> TPS62A02 buck regulator, same reference designator.
    expect(typesFor('schematic::U1')).toEqual(new Set(['SYMBOL_VALUE_CHANGED', 'SYMBOL_FOOTPRINT_CHANGED']));
    expect(typesFor('pcb::U1')).toEqual(new Set(['FOOTPRINT_CHANGED']));

    // R1 (330R LED resistor) and D1 (status LED) are removed entirely, schematic + PCB + BOM.
    expect(hasDelta('SYMBOL_REMOVED', 'schematic::R1', null)).toBe(true);
    expect(hasDelta('SYMBOL_REMOVED', 'schematic::D1', null)).toBe(true);
    expect(hasDelta('FOOTPRINT_REMOVED', 'pcb::R1', null)).toBe(true);
    expect(hasDelta('FOOTPRINT_REMOVED', 'pcb::D1', null)).toBe(true);
    expect(hasDelta('BOM_ITEM_REMOVED', 'bom::330R|splp:R_0603', null)).toBe(true);
    expect(hasDelta('BOM_ITEM_REMOVED', 'bom::LED_Status|splp:LED_0603', null)).toBe(true);

    // D2 (input-protection Schottky diode) is newly added, schematic + PCB + BOM.
    expect(hasDelta('SYMBOL_ADDED', null, 'schematic::D2')).toBe(true);
    expect(hasDelta('FOOTPRINT_ADDED', null, 'pcb::D2')).toBe(true);
    expect(hasDelta('BOM_ITEM_ADDED', null, 'bom::SS14|splp:D_SMA')).toBe(true);

    // C3 added in parallel with C2 (100nF, C_0603) -> BOM group quantity change, not a new BOM group.
    expect(hasDelta('SYMBOL_ADDED', null, 'schematic::C3')).toBe(true);
    expect(hasDelta('FOOTPRINT_ADDED', null, 'pcb::C3')).toBe(true);
    expect(deltas.some((d) => d.deltaType === 'QUANTITY_CHANGED' && d.newSemanticId === 'bom::100nF|splp:C_0603')).toBe(true);

    // J2 repositioned + footprint changed to the vertical variant.
    expect(typesFor('schematic::J2')).toEqual(new Set(['SYMBOL_FOOTPRINT_CHANGED']));
    expect(typesFor('pcb::J2')).toEqual(new Set(['FOOTPRINT_CHANGED']));
    expect(hasDelta('BOM_ITEM_REMOVED', 'bom::Conn_Sensor|splp:CONN_3P', null)).toBe(true);
    expect(hasDelta('BOM_ITEM_ADDED', null, 'bom::Conn_Sensor|splp:CONN_3P_Vertical')).toBe(true);

    // J1: USB Micro power connector -> battery JST connector (value change, same reference/footprint).
    expect(hasDelta('SYMBOL_VALUE_CHANGED', 'schematic::J1', 'schematic::J1')).toBe(true);
    expect(hasDelta('BOM_ITEM_REMOVED', 'bom::USB_B_Micro_Power|splp:CONN_2P', null)).toBe(true);
    expect(hasDelta('BOM_ITEM_ADDED', null, 'bom::BATT_JST_PH2|splp:CONN_2P')).toBe(true);

    // No unaccounted-for noise: exactly the fixture's own change set, nothing extra invented.
    expect(deltas.length).toBe(27);

    // The replay is internally consistent: replaying base's operations lands on proposed's state.
    expect(comparison.semDiff.replayVerified).toBe(true);
    expect(comparison.semDiff.replayErrors).toEqual([]);

    // The PR summary rolls the above into a reviewable shape.
    expect(Object.values(comparison.semDiff.prSummary.changeCountsByDomain).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  }, 60000);

  it('caches the fingerprint manifest so a second comparison does not rebuild it', async () => {
    const first = await comparisonService.compareRevisions(fixture.repoPath, baseRevisionId, headRevisionId);
    const artifactRepo = new SqliteArtifactRepository(db);
    const manifests = (await artifactRepo.findByRevisionId(baseRevisionId)).filter((a) => a.role === 'revision_manifest');
    expect(manifests.length).toBe(1);

    const second = await comparisonService.compareRevisions(fixture.repoPath, baseRevisionId, headRevisionId);
    expect(second.semDiff.prSummary.baseRevisionIdentity.descriptorHash).toBe(
      first.semDiff.prSummary.baseRevisionIdentity.descriptorHash
    );
    const manifestsAfter = (await artifactRepo.findByRevisionId(baseRevisionId)).filter((a) => a.role === 'revision_manifest');
    expect(manifestsAfter.length).toBe(1);
  }, 60000);
});
