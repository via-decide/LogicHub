import { describe, it, expect } from 'vitest';
import { EngineeringPullRequestSchema } from '../src/index.js';

const valid = {
  id: 'pr-1',
  projectId: 'proj-1',
  number: 1,
  title: 'Switch to battery input',
  baseBranch: 'main',
  baseRevisionId: 'rev-1',
  headBranch: 'feature/battery-input',
  headRevisionId: 'rev-2',
  author: 'alice',
  approvals: [],
  changeRequests: [],
  createdAt: '2026-01-15T10:00:00+00:00',
};

describe('EngineeringPullRequestSchema', () => {
  it('parses a valid PR', () => {
    const result = EngineeringPullRequestSchema.parse(valid);
    expect(result.status).toBe('draft');
    expect(result.requiredApprovals).toBe(1);
  });

  it('accepts all status values', () => {
    for (const s of ['draft', 'open', 'changes_requested', 'approved', 'merged', 'closed', 'rejected']) {
      expect(() => EngineeringPullRequestSchema.parse({ ...valid, status: s })).not.toThrow();
    }
  });

  it('accepts reviews', () => {
    const withReviews = {
      ...valid,
      approvals: [{ reviewer: 'bob', decision: 'approve' as const, createdAt: '2026-01-16T10:00:00+00:00' }],
      changeRequests: [{ reviewer: 'charlie', decision: 'request_changes' as const, comment: 'Fix traces', createdAt: '2026-01-16T09:00:00+00:00' }],
    };
    const result = EngineeringPullRequestSchema.parse(withReviews);
    expect(result.approvals).toHaveLength(1);
    expect(result.changeRequests).toHaveLength(1);
  });

  it('accepts merge eligibility', () => {
    const withEligibility = {
      ...valid,
      mergeEligibility: {
        eligible: false,
        blockers: [{ code: 'LH_ERC_FAILED', message: 'ERC has errors' }],
      },
    };
    const result = EngineeringPullRequestSchema.parse(withEligibility);
    expect(result.mergeEligibility?.eligible).toBe(false);
    expect(result.mergeEligibility?.blockers).toHaveLength(1);
  });

  it('rejects non-positive PR number', () => {
    expect(() => EngineeringPullRequestSchema.parse({ ...valid, number: 0 })).toThrow();
    expect(() => EngineeringPullRequestSchema.parse({ ...valid, number: -1 })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = EngineeringPullRequestSchema.parse(valid);
    expect(EngineeringPullRequestSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
