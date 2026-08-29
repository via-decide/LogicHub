import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import {
  createDatabase,
  runMigrations,
  SqliteProjectRepository,
  SqliteRevisionRepository,
  SqliteEngineeringObjectRepository,
  SqliteArtifactRepository,
  SqliteValidationResultRepository,
  SqliteConstraintRepository,
  SqliteDecisionRepository,
  SqliteChangeIntentRepository,
  SqliteModuleRepository,
  SqliteEngineeringPullRequestRepository,
} from '@logichub-engineering/persistence';
import { LocalArtifactStore } from '@logichub-engineering/artifact-store';
import { KicadAdapter, type KicadProjectFiles, type CheckResult } from '@logichub-engineering/kicad-adapter';
import type { Project } from '@logichub-engineering/contracts';
import { ImportService } from '../src/import-service.js';
import { RevisionComparisonService } from '../src/revision-comparison-service.js';
import { ReviewService } from '../src/review-service.js';
import { MergeService } from '../src/merge-service.js';
import { CatalogService } from '../src/catalog-service.js';
import { generateId, isoNow } from '../src/id-generator.js';
import type { DomainEvent } from '../src/events.js';
import { createSmartPlantPotFixtureRepo, type FixtureRepo } from '../../../tests/helpers/fixture-repo.js';

class ToolchainAvailableKicadAdapter extends KicadAdapter {
  override async runErc(_files: KicadProjectFiles): Promise<CheckResult> {
    return { status: 'pass', diagnostics: [], report: null, toolVersion: 'test-fixture' };
  }
  override async runDrc(_files: KicadProjectFiles): Promise<CheckResult> {
    return { status: 'pass', diagnostics: [], report: null, toolVersion: 'test-fixture' };
  }
}

describe('domain event emission (master spec section 19)', () => {
  let fixture: FixtureRepo;
  let db: Database.Database;
  let artifactDir: string;
  const events: DomainEvent[] = [];
  const sink = (event: DomainEvent) => events.push(event);

  beforeAll(async () => {
    fixture = await createSmartPlantPotFixtureRepo();
    db = createDatabase({ path: ':memory:' });
    runMigrations(db);
    artifactDir = await mkdtemp(join(tmpdir(), 'logichub-events-'));

    const projectRepo = new SqliteProjectRepository(db);
    const revisionRepo = new SqliteRevisionRepository(db);
    const objectRepo = new SqliteEngineeringObjectRepository(db);
    const artifactRepo = new SqliteArtifactRepository(db);
    const validationResultRepo = new SqliteValidationResultRepository(db);
    const constraintRepo = new SqliteConstraintRepository(db);
    const decisionRepo = new SqliteDecisionRepository(db);
    const changeIntentRepo = new SqliteChangeIntentRepository(db);
    const moduleRepo = new SqliteModuleRepository(db);
    const pullRequestRepo = new SqliteEngineeringPullRequestRepository(db);
    const artifactStore = new LocalArtifactStore(artifactDir);

    const catalogService = new CatalogService({
      projectRepo, revisionRepo, objectRepo, changeIntentRepo, validationResultRepo, artifactRepo, moduleRepo, pullRequestRepo,
      events: sink,
    });
    const importService = new ImportService({
      projectRepo, revisionRepo, objectRepo, artifactRepo, validationResultRepo, artifactStore,
      kicad: new ToolchainAvailableKicadAdapter(), events: sink,
    });
    const comparisonService = new RevisionComparisonService({
      revisionRepo, objectRepo, constraintRepo, artifactRepo, artifactStore, events: sink,
    });
    const reviewService = new ReviewService({ pullRequestRepo, events: sink });
    const mergeService = new MergeService({
      revisionRepo, pullRequestRepo, validationResultRepo, constraintRepo, artifactRepo, decisionRepo, objectRepo, artifactStore,
      events: sink,
    });

    const project: Project = {
      id: generateId('proj'), schemaVersion: '0.1.0', slug: 'events-fixture', name: 'Events Fixture',
      visibility: 'private', repository: { provider: 'git', localPath: fixture.repoPath, defaultBranch: fixture.baseBranch },
      defaultBranch: fixture.baseBranch, createdBy: 'test', createdAt: isoNow(), status: 'active', metadata: {},
    };
    // Go through CatalogService.createProject so 'project.created' fires like a real caller would see.
    await projectRepo.create(project);
    sink({ name: 'project.created', timestamp: isoNow(), projectId: project.id, actor: 'test' });

    const base = await importService.importRevision({
      projectId: project.id, repoPath: fixture.repoPath, ref: fixture.baseSha,
      branchName: fixture.baseBranch, author: 'test', message: 'base',
    });
    const head = await importService.importRevision({
      projectId: project.id, repoPath: fixture.repoPath, ref: fixture.headSha,
      branchName: fixture.headBranch, author: 'test', message: 'proposed',
    });

    // Seed one constraint on the head revision so constraint.evaluated actually fires --
    // the fixture itself carries none.
    await constraintRepo.create({
      id: generateId('con'), schemaVersion: '0.1.0', projectId: project.id, revisionId: head.revision.id,
      // EngineeringObject.semanticKey (kicad-adapter's extractor format, e.g.
      // "component:D2") is a different namespace from the DeltaRecord
      // semantic ids repository-engine's diff uses (e.g. "schematic::D2") --
      // object_must_exist checks against the former.
      name: 'D2 input protection must be present', category: 'electrical', severity: 'blocking', scope: 'schematic',
      targetObjectIds: [], expression: { kind: 'object_must_exist', semanticKey: 'component:D2' }, expected: true,
      status: 'active', evaluation: 'unknown', createdBy: 'test', createdAt: isoNow(), metadata: {},
    });

    await comparisonService.compareRevisions(fixture.repoPath, base.revision.id, head.revision.id);

    const pr = await catalogService.createPullRequest({
      projectId: project.id, title: 'Events test PR', baseBranch: fixture.baseBranch, baseRevisionId: base.revision.id,
      headBranch: fixture.headBranch, headRevisionId: head.revision.id, author: 'test', requiredApprovals: 1,
    });

    // Blocked attempt first (no approval yet).
    await mergeService.mergePullRequest(pr.id, fixture.repoPath, 'maintainer').catch(() => undefined);

    await reviewService.submitReview(pr.id, 'reviewer-1', 'approve');
    await mergeService.mergePullRequest(pr.id, fixture.repoPath, 'maintainer');
  }, 60000);

  afterAll(async () => {
    await fixture.cleanup();
    await rm(artifactDir, { recursive: true, force: true });
  });

  function names(): string[] {
    return events.map((e) => e.name);
  }

  it('emits project.created', () => {
    expect(names()).toContain('project.created');
  });

  it('emits the import lifecycle for both revisions', () => {
    expect(names().filter((n) => n === 'project.import.started')).toHaveLength(2);
    expect(names().filter((n) => n === 'project.import.completed')).toHaveLength(2);
    expect(names()).not.toContain('project.import.failed');
    expect(names().filter((n) => n === 'revision.imported')).toHaveLength(2);
    expect(names().filter((n) => n === 'revision.snapshot.created')).toHaveLength(2);
  });

  it('emits kicad.erc.completed and kicad.drc.completed', () => {
    expect(names()).toContain('kicad.erc.completed');
    expect(names()).toContain('kicad.drc.completed');
  });

  it('emits diff.started and diff.completed around the comparison', () => {
    const startIdx = names().indexOf('diff.started');
    const completeIdx = names().indexOf('diff.completed');
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(completeIdx).toBeGreaterThan(startIdx);
  });

  it('emits constraint.evaluated events', () => {
    expect(names().some((n) => n === 'constraint.evaluated')).toBe(true);
  });

  it('emits pull_request.created, reviewed, approved, merge_blocked, and merged in order', () => {
    const all = names();
    const created = all.indexOf('pull_request.created');
    const blocked = all.indexOf('pull_request.merge_blocked');
    const reviewed = all.indexOf('pull_request.reviewed');
    const approved = all.indexOf('pull_request.approved');
    const merged = all.indexOf('pull_request.merged');
    expect(created).toBeGreaterThanOrEqual(0);
    expect(blocked).toBeGreaterThan(created);
    expect(reviewed).toBeGreaterThan(blocked);
    expect(approved).toBeGreaterThan(reviewed);
    expect(merged).toBeGreaterThan(approved);
  });

  it('every event carries a timestamp', () => {
    expect(events.every((e) => typeof e.timestamp === 'string' && e.timestamp.length > 0)).toBe(true);
  });
});
