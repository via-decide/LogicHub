import { describe, it, expect } from 'vitest';
import type { ReviewRecord } from '@logichub-engineering/contracts';
import { applyReview, summarizeReviewState, nextPrStatus, type ReviewHistory } from '../src/review-workflow.js';

function record(reviewer: string, decision: ReviewRecord['decision'], createdAt: string): ReviewRecord {
  return { reviewer, decision, createdAt };
}

describe('applyReview', () => {
  it('appends an approval to approvals only', () => {
    const history: ReviewHistory = { approvals: [], changeRequests: [] };
    const result = applyReview(history, record('alice', 'approve', '2026-01-01T00:00:00Z'));
    expect(result.approvals).toHaveLength(1);
    expect(result.changeRequests).toHaveLength(0);
  });

  it('appends a request_changes to changeRequests only', () => {
    const history: ReviewHistory = { approvals: [], changeRequests: [] };
    const result = applyReview(history, record('alice', 'request_changes', '2026-01-01T00:00:00Z'));
    expect(result.approvals).toHaveLength(0);
    expect(result.changeRequests).toHaveLength(1);
  });

  it('a comment changes neither list', () => {
    const history: ReviewHistory = { approvals: [], changeRequests: [] };
    const result = applyReview(history, record('alice', 'comment', '2026-01-01T00:00:00Z'));
    expect(result).toEqual(history);
  });
});

describe('summarizeReviewState', () => {
  it('counts one approval per approving reviewer', () => {
    const history: ReviewHistory = {
      approvals: [record('alice', 'approve', '2026-01-01T00:00:00Z'), record('bob', 'approve', '2026-01-01T00:01:00Z')],
      changeRequests: [],
    };
    expect(summarizeReviewState(history).approvalCount).toBe(2);
  });

  it('a later approval from the same reviewer who previously requested changes resolves the request', () => {
    const history: ReviewHistory = {
      approvals: [record('alice', 'approve', '2026-01-01T01:00:00Z')],
      changeRequests: [record('alice', 'request_changes', '2026-01-01T00:00:00Z')],
    };
    const summary = summarizeReviewState(history);
    expect(summary.approvalCount).toBe(1);
    expect(summary.unresolvedChangeRequests).toHaveLength(0);
  });

  it('a later request_changes from a reviewer who previously approved revokes the approval', () => {
    const history: ReviewHistory = {
      approvals: [record('alice', 'approve', '2026-01-01T00:00:00Z')],
      changeRequests: [record('alice', 'request_changes', '2026-01-01T01:00:00Z')],
    };
    const summary = summarizeReviewState(history);
    expect(summary.approvalCount).toBe(0);
    expect(summary.unresolvedChangeRequests).toHaveLength(1);
  });

  it('multiple reviewers with mixed, out-of-order decisions resolve independently', () => {
    const history: ReviewHistory = {
      approvals: [record('bob', 'approve', '2026-01-01T00:00:00Z')],
      changeRequests: [
        record('alice', 'request_changes', '2026-01-01T02:00:00Z'),
        record('carol', 'request_changes', '2026-01-01T00:30:00Z'),
      ],
    };
    const summary = summarizeReviewState(history);
    expect(summary.approvalCount).toBe(1);
    expect(summary.unresolvedChangeRequests.map((r) => r.reviewer).sort()).toEqual(['alice', 'carol']);
  });
});

describe('nextPrStatus', () => {
  it('from open: moves to changes_requested when an unresolved request_changes exists, regardless of approval count', () => {
    const history: ReviewHistory = {
      approvals: [record('bob', 'approve', '2026-01-01T00:00:00Z')],
      changeRequests: [record('alice', 'request_changes', '2026-01-01T00:01:00Z')],
    };
    expect(nextPrStatus('open', history, 1)).toBe('changes_requested');
  });

  it('from open: moves to approved once the required approval count is met with no unresolved change requests', () => {
    const history: ReviewHistory = { approvals: [record('bob', 'approve', '2026-01-01T00:00:00Z')], changeRequests: [] };
    expect(nextPrStatus('open', history, 1)).toBe('approved');
  });

  it('from open: stays open below the required approval count', () => {
    const history: ReviewHistory = { approvals: [record('bob', 'approve', '2026-01-01T00:00:00Z')], changeRequests: [] };
    expect(nextPrStatus('open', history, 2)).toBe('open');
  });

  it('from changes_requested: moves to open once every change request is resolved (never straight to approved -- matches the frozen one-hop graph)', () => {
    const history: ReviewHistory = {
      approvals: [record('alice', 'approve', '2026-01-01T01:00:00Z'), record('bob', 'approve', '2026-01-01T00:00:00Z')],
      changeRequests: [record('alice', 'request_changes', '2026-01-01T00:00:00Z')],
    };
    expect(nextPrStatus('changes_requested', history, 2)).toBe('open');
  });

  it('from changes_requested: stays changes_requested while any reviewer still has an unresolved request', () => {
    const history: ReviewHistory = {
      approvals: [],
      changeRequests: [record('alice', 'request_changes', '2026-01-01T00:00:00Z')],
    };
    expect(nextPrStatus('changes_requested', history, 1)).toBe('changes_requested');
  });

  it('from approved: never reverts, even if a new request_changes is submitted (the graph has no approved -> changes_requested edge)', () => {
    const history: ReviewHistory = {
      approvals: [record('bob', 'approve', '2026-01-01T00:00:00Z')],
      changeRequests: [record('alice', 'request_changes', '2026-01-01T01:00:00Z')],
    };
    expect(nextPrStatus('approved', history, 1)).toBe('approved');
  });

  it('never moves a terminal status', () => {
    const history: ReviewHistory = { approvals: [record('bob', 'approve', '2026-01-01T00:00:00Z')], changeRequests: [] };
    expect(nextPrStatus('merged', history, 1)).toBe('merged');
    expect(nextPrStatus('closed', history, 1)).toBe('closed');
    expect(nextPrStatus('rejected', history, 1)).toBe('rejected');
  });
});
