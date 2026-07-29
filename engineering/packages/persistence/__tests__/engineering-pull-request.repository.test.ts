import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../src/repositories/project.repository.js';
import { SqliteRevisionRepository } from '../src/repositories/revision.repository.js';
import { SqliteEngineeringPullRequestRepository } from '../src/repositories/engineering-pull-request.repository.js';
import { createTestDb, makeProject, makeRevision, makePullRequest } from './helpers.js';

describe('SqliteEngineeringPullRequestRepository', () => {
  let db: Database.Database;
  let repo: SqliteEngineeringPullRequestRepository;

  beforeEach(async () => {
    db = createTestDb();
    const projRepo = new SqliteProjectRepository(db);
    const revRepo = new SqliteRevisionRepository(db);
    await projRepo.create(makeProject());
    await revRepo.create(makeRevision());
    await revRepo.create(makeRevision({ id: 'rev-2', gitCommitSha: 'b'.repeat(40) }));
    repo = new SqliteEngineeringPullRequestRepository(db);
  });

  it('creates and finds by id', async () => {
    await repo.create(makePullRequest());
    const found = await repo.findById('epr-1');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Add bypass capacitors');
    expect(found!.number).toBe(1);
    expect(found!.author).toBe('user-1');
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('finds by project id', async () => {
    await repo.create(makePullRequest());
    await repo.create(makePullRequest({ id: 'epr-2', number: 2, title: 'Fix routing' }));
    const results = await repo.findByProjectId('proj-1');
    expect(results).toHaveLength(2);
  });

  it('finds by number', async () => {
    await repo.create(makePullRequest());
    const found = await repo.findByNumber('proj-1', 1);
    expect(found).not.toBeNull();
    expect(found!.id).toBe('epr-1');
  });

  it('updates status via valid transition', async () => {
    await repo.create(makePullRequest());
    await repo.updateStatus('epr-1', 'open');
    const found = await repo.findById('epr-1');
    expect(found!.status).toBe('open');
  });

  it('rejects invalid transition', async () => {
    await repo.create(makePullRequest());
    await expect(repo.updateStatus('epr-1', 'merged')).rejects.toThrow();
  });

  it('rejects status change on terminal state', async () => {
    await repo.create(makePullRequest());
    await repo.updateStatus('epr-1', 'closed');
    await expect(repo.updateStatus('epr-1', 'open')).rejects.toThrow(/terminal/i);
  });

  it('updates computed fields', async () => {
    await repo.create(makePullRequest());
    await repo.updateComputedFields('epr-1', {
      diffSummary: { filesAdded: 1, filesModified: 2, filesDeleted: 0, objectsAdded: 5, objectsModified: 3, objectsRemoved: 0 },
      validationSummary: { total: 3, passed: 2, warnings: 1, failed: 0, unknown: 0 },
    });
    const found = await repo.findById('epr-1');
    expect(found!.diffSummary!.filesAdded).toBe(1);
    expect(found!.validationSummary!.passed).toBe(2);
  });

  it('adds approval', async () => {
    await repo.create(makePullRequest());
    await repo.addApproval('epr-1', {
      reviewer: 'reviewer-1',
      decision: 'approve',
      comment: 'LGTM',
      createdAt: '2025-01-15T11:00:00.000Z',
    });
    const found = await repo.findById('epr-1');
    expect(found!.approvals).toHaveLength(1);
    expect(found!.approvals[0]!.reviewer).toBe('reviewer-1');
  });

  it('adds change request', async () => {
    await repo.create(makePullRequest());
    await repo.addChangeRequest('epr-1', {
      reviewer: 'reviewer-2',
      decision: 'request_changes',
      comment: 'Fix clearance violations',
      createdAt: '2025-01-15T11:00:00.000Z',
    });
    const found = await repo.findById('epr-1');
    expect(found!.changeRequests).toHaveLength(1);
    expect(found!.changeRequests[0]!.decision).toBe('request_changes');
  });

  it('rejects duplicate id', async () => {
    await repo.create(makePullRequest());
    await expect(repo.create(makePullRequest())).rejects.toThrow();
  });
});
