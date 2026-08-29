import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
  SqliteEngineeringPullRequestRepository,
} from '@logichub-engineering/persistence';
import { LocalArtifactStore } from '@logichub-engineering/artifact-store';
import { KicadAdapter, type KicadProjectFiles, type CheckResult } from '@logichub-engineering/kicad-adapter';
import type { Project, EngineeringPullRequest } from '@logichub-engineering/contracts';
import { ImportService } from '../src/import-service.js';
import { MergeService } from '../src/merge-service.js';
import { ReviewService } from '../src/review-service.js';
import { generateId, isoNow } from '../src/id-generator.js';
import { createSmartPlantPotFixtureRepo, type FixtureRepo } from '../../../tests/helpers/fixture-repo.js';

const execFileAsync = promisify(execFile);

/**
 * The sandbox this test runs in has no kicad-cli, so the real KicadAdapter
 * honestly reports ERC/DRC as 'skipped' (kicad-adapter's own tests already
 * cover that convention). This test exercises MergeService's gate wiring --
 * not kicad-cli availability -- so it simulates a toolchain-equipped
 * environment for ERC/DRC only, leaving every other KicadAdapter method
 * (parsing, extraction, rendering) real.
 */
class ToolchainAvailableKicadAdapter extends KicadAdapter {
  override async runErc(_files: KicadProjectFiles): Promise<CheckResult> {
    return { status: 'pass', diagnostics: [], report: null, toolVersion: 'test-fixture' };
  }
  override async runDrc(_files: KicadProjectFiles): Promise<CheckResult> {
    return { status: 'pass', diagnostics: [], report: null, toolVersion: 'test-fixture' };
  }
}

describe('MergeService against the real smart-plant-pot fixture', () => {
  let fixture: FixtureRepo;
  let db: Database.Database;
  let artifactDir: string;
  let project: Project;
  let mergeService: MergeService;
  let pullRequestRepo: SqliteEngineeringPullRequestRepository;
  let headRevisionId: string;
  let baseRevisionId: string;
  let pr: EngineeringPullRequest;

  beforeAll(async () => {
    fixture = await createSmartPlantPotFixtureRepo();

    db = createDatabase({ path: ':memory:' });
    runMigrations(db);
    artifactDir = await mkdtemp(join(tmpdir(), 'logichub-merge-artifacts-'));

    const projectRepo = new SqliteProjectRepository(db);
    const revisionRepo = new SqliteRevisionRepository(db);
    const objectRepo = new SqliteEngineeringObjectRepository(db);
    const artifactRepo = new SqliteArtifactRepository(db);
    const validationResultRepo = new SqliteValidationResultRepository(db);
    const constraintRepo = new SqliteConstraintRepository(db);
    const decisionRepo = new SqliteDecisionRepository(db);
    pullRequestRepo = new SqliteEngineeringPullRequestRepository(db);
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

    const importService = new ImportService({
      projectRepo, revisionRepo, objectRepo, artifactRepo, validationResultRepo, artifactStore,
      kicad: new ToolchainAvailableKicadAdapter(),
    });
    const base = await importService.importRevision({
      projectId: project.id, repoPath: fixture.repoPath, ref: fixture.baseSha,
      branchName: fixture.baseBranch, author: 'fixture', message: 'base',
    });
    baseRevisionId = base.revision.id;

    const head = await importService.importRevision({
      projectId: project.id, repoPath: fixture.repoPath, ref: fixture.headSha,
      branchName: fixture.headBranch, author: 'fixture', message: 'proposed',
    });
    headRevisionId = head.revision.id;
    const now = isoNow();

    mergeService = new MergeService({
      revisionRepo, pullRequestRepo, validationResultRepo, constraintRepo, artifactRepo, decisionRepo, objectRepo, artifactStore,
    });

    pr = {
      id: generateId('pr'),
      schemaVersion: '0.1.0',
      projectId: project.id,
      number: 1,
      title: 'Input protection + regulator swap',
      baseBranch: fixture.baseBranch,
      baseRevisionId,
      headBranch: fixture.headBranch,
      headRevisionId,
      author: 'fixture',
      status: 'open',
      requiredApprovals: 1,
      approvals: [],
      changeRequests: [],
      createdAt: now,
      metadata: {},
    };
    await pullRequestRepo.create(pr);
  }, 60000);

  afterAll(async () => {
    await fixture.cleanup();
    await rm(artifactDir, { recursive: true, force: true });
  });

  it('reports ineligible with a REQUIRED_APPROVALS_SATISFIED blocker before any review', async () => {
    const result = await mergeService.recalculateEligibility(pr.id, fixture.repoPath);
    expect(result.eligible).toBe(false);
    expect(result.blockers.map((b) => b.code)).toContain('REQUIRED_APPROVALS_SATISFIED');
  });

  it('refuses to merge while ineligible, leaving the base branch untouched', async () => {
    await expect(mergeService.mergePullRequest(pr.id, fixture.repoPath, 'maintainer')).rejects.toMatchObject({
      code: 'LH_MERGE_BLOCKED',
    });
    const { stdout } = await execFileAsync('git', ['rev-parse', fixture.baseBranch], { cwd: fixture.repoPath });
    expect(stdout.trim()).toBe(fixture.baseSha);
  });

  it('becomes eligible once approved, and merging produces a new immutable revision on the base branch', async () => {
    const reviewService = new ReviewService({ pullRequestRepo });
    const afterReview = await reviewService.submitReview(pr.id, 'reviewer-1', 'approve');
    expect(afterReview.status).toBe('approved');

    const eligibility = await mergeService.recalculateEligibility(pr.id, fixture.repoPath);
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.blockers).toEqual([]);

    const { pullRequest, revision } = await mergeService.mergePullRequest(pr.id, fixture.repoPath, 'maintainer');

    expect(pullRequest.status).toBe('merged');
    expect(pullRequest.mergedRevisionId).toBe(revision.id);
    expect(pullRequest.mergeEligibility?.eligible).toBe(true);
    expect(revision.status).toBe('merged');
    expect(revision.parentRevisionIds).toEqual([baseRevisionId, headRevisionId]);

    const { stdout } = await execFileAsync('git', ['rev-parse', fixture.baseBranch], { cwd: fixture.repoPath });
    expect(stdout.trim()).toBe(revision.gitCommitSha);
  });

  it('refuses a second merge attempt on an already-merged pull request', async () => {
    await expect(mergeService.mergePullRequest(pr.id, fixture.repoPath, 'maintainer')).rejects.toThrow();
  });
});
