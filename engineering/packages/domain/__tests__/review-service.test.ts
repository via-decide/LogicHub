import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  createDatabase,
  runMigrations,
  SqliteProjectRepository,
  SqliteRevisionRepository,
  SqliteEngineeringPullRequestRepository,
} from '@logichub-engineering/persistence';
import type { EngineeringPullRequest, Project, Revision } from '@logichub-engineering/contracts';
import { ReviewService } from '../src/review-service.js';
import { generateId, isoNow } from '../src/id-generator.js';

describe('ReviewService', () => {
  let db: Database.Database;
  let pullRequestRepo: SqliteEngineeringPullRequestRepository;
  let reviewService: ReviewService;
  let pr: EngineeringPullRequest;

  beforeEach(async () => {
    db = createDatabase({ path: ':memory:' });
    runMigrations(db);
    const projectRepo = new SqliteProjectRepository(db);
    const revisionRepo = new SqliteRevisionRepository(db);
    pullRequestRepo = new SqliteEngineeringPullRequestRepository(db);
    reviewService = new ReviewService({ pullRequestRepo });

    const project: Project = {
      id: 'proj-1',
      schemaVersion: '0.1.0',
      slug: 'test-project',
      name: 'Test Project',
      visibility: 'private',
      repository: { provider: 'git', localPath: '/tmp/does-not-matter', defaultBranch: 'main' },
      defaultBranch: 'main',
      createdBy: 'test',
      createdAt: isoNow(),
      status: 'active',
      metadata: {},
    };
    await projectRepo.create(project);

    const makeRevision = (id: string, branchName: string): Revision => ({
      id,
      schemaVersion: '0.1.0',
      projectId: project.id,
      gitCommitSha: '0'.repeat(40),
      branchName,
      parentRevisionIds: [],
      author: 'test',
      message: 'test revision',
      createdAt: isoNow(),
      toolchain: {},
      status: 'imported',
      metadata: {},
    });
    await revisionRepo.create(makeRevision('rev-base', 'main'));
    await revisionRepo.create(makeRevision('rev-head', 'feature'));

    pr = {
      id: generateId('pr'),
      schemaVersion: '0.1.0',
      projectId: project.id,
      number: 1,
      title: 'Test PR',
      baseBranch: 'main',
      baseRevisionId: 'rev-base',
      headBranch: 'feature',
      headRevisionId: 'rev-head',
      author: 'author',
      status: 'open',
      requiredApprovals: 2,
      approvals: [],
      changeRequests: [],
      createdAt: isoNow(),
      metadata: {},
    };
    await pullRequestRepo.create(pr);
  });

  it('stays open below the required approval count', async () => {
    const updated = await reviewService.submitReview(pr.id, 'alice', 'approve');
    expect(updated.status).toBe('open');
    expect(updated.approvals).toHaveLength(1);
  });

  it('moves to approved once the required approval count is reached', async () => {
    await reviewService.submitReview(pr.id, 'alice', 'approve');
    const updated = await reviewService.submitReview(pr.id, 'bob', 'approve');
    expect(updated.status).toBe('approved');
  });

  it('moves to changes_requested on a request_changes review before the PR is approved', async () => {
    await reviewService.submitReview(pr.id, 'alice', 'approve');
    const updated = await reviewService.submitReview(pr.id, 'carol', 'request_changes', 'Please fix the footprint');
    expect(updated.status).toBe('changes_requested');
  });

  it('crosses changes_requested -> open -> approved in one submission when the resolving review also satisfies the approval count', async () => {
    await reviewService.submitReview(pr.id, 'alice', 'approve');
    await reviewService.submitReview(pr.id, 'carol', 'request_changes');
    const resolved = await reviewService.submitReview(pr.id, 'carol', 'approve');
    expect(resolved.status).toBe('approved');
  });

  it('does not revert an already-approved PR on a later request_changes -- the frozen graph has no edge back down, gate #14 is the real merge-time check', async () => {
    await reviewService.submitReview(pr.id, 'alice', 'approve');
    const approved = await reviewService.submitReview(pr.id, 'bob', 'approve');
    expect(approved.status).toBe('approved');

    const afterLateObjection = await reviewService.submitReview(pr.id, 'carol', 'request_changes', 'Actually, wait');
    expect(afterLateObjection.status).toBe('approved');
    expect(afterLateObjection.changeRequests).toHaveLength(1);
  });

  it('a comment review does not change status or the approval/change-request lists', async () => {
    const updated = await reviewService.submitReview(pr.id, 'alice', 'comment', 'looks fine so far');
    expect(updated.status).toBe('open');
    expect(updated.approvals).toHaveLength(0);
    expect(updated.changeRequests).toHaveLength(0);
  });

  it('refuses a review on an already-merged pull request', async () => {
    await pullRequestRepo.updateStatus(pr.id, 'approved');
    await pullRequestRepo.updateStatus(pr.id, 'merged');
    await expect(reviewService.submitReview(pr.id, 'dave', 'approve')).rejects.toMatchObject({
      code: 'LH_STATE_TRANSITION_INVALID',
    });
  });
});
