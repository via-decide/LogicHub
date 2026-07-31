import { describe, it, expect } from 'vitest';
import {
  canClaimIssue,
  markIssueClaimed,
  reopenIssueAfterFailure,
  createPullRequestFromClaim,
  beginInspection,
  beginEvaluation,
  applyRunResult,
  mergePullRequest,
  allConditionsMet,
} from '../src/marketplace/workflow.js';
import type { Issue, Claim, ReleaseCondition } from '../src/marketplace/marketplace.schema.js';
import type { PipelineRun } from '../src/pipeline/merge-gate.js';

const NOW = '2026-03-01T09:00:00.000Z';
const LATER = '2026-03-01T09:05:00.000Z';

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'ISSUE-1',
    schemaVersion: '0.1.0',
    repositoryId: 'via-decide/LogicHub',
    title: 'Manufacture a cartridge shell',
    description: 'Per the attached spec.',
    rulesetYaml: 'rules:\n  - property: diameter_mm\n    target: 25\n    tolerance: 0.05\n',
    requiredNodeIds: ['micrometer-01'],
    bounty: { state: 'UNAVAILABLE', reason: 'No component has been sourced.' },
    status: 'OPEN',
    createdAt: NOW,
    createdBy: 'creator-1',
    ...overrides,
  };
}

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'CLAIM-1',
    issueId: 'ISSUE-1',
    vendorId: 'vendor-1',
    branchName: 'vendor-1/issue-1',
    claimedAt: NOW,
    ...overrides,
  };
}

function run(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    digest: 'a'.repeat(64),
    state: 'PASSED',
    ciStatus: 0,
    codes: [],
    rules: null,
    detail: 'All rules evaluated true.',
    ...overrides,
  };
}

describe('canClaimIssue / markIssueClaimed', () => {
  it('allows claiming an open issue', () => {
    expect(canClaimIssue(issue()).allowed).toBe(true);
  });

  it('refuses a claim on an already-claimed issue', () => {
    const decision = canClaimIssue(issue({ status: 'CLAIMED' }));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('CLAIMED');
  });

  it('refuses a claim on a closed issue', () => {
    expect(canClaimIssue(issue({ status: 'CLOSED' })).allowed).toBe(false);
  });

  it('markIssueClaimed flips status only when the issue was open', () => {
    expect(markIssueClaimed(issue()).status).toBe('CLAIMED');
    expect(() => markIssueClaimed(issue({ status: 'CLAIMED' }))).toThrow();
  });

  it('reopenIssueAfterFailure returns a CLAIMED issue to OPEN, so a fresh claim is possible', () => {
    const reopened = reopenIssueAfterFailure(issue({ status: 'CLAIMED' }));
    expect(reopened.status).toBe('OPEN');
    expect(canClaimIssue(reopened).allowed).toBe(true);
  });
});

describe('createPullRequestFromClaim', () => {
  it('starts a new pull request at DRAFT', () => {
    const pr = createPullRequestFromClaim('PR-1', issue(), claim(), NOW);
    expect(pr.state).toBe('DRAFT');
    expect(pr.issueId).toBe('ISSUE-1');
    expect(pr.vendorId).toBe('vendor-1');
    expect(pr.evaluatedDigests).toEqual([]);
  });

  it('refuses a claim that names a different issue', () => {
    expect(() =>
      createPullRequestFromClaim('PR-1', issue({ id: 'ISSUE-2' }), claim(), NOW),
    ).toThrow(/ISSUE-1/);
  });
});

describe('pull request state transitions', () => {
  it('walks DRAFT -> IN_INSPECTION -> EVALUATING -> PASSED -> MERGED, one legal step at a time', () => {
    let pr = createPullRequestFromClaim('PR-1', issue(), claim(), NOW);
    pr = beginInspection(pr, NOW);
    expect(pr.state).toBe('IN_INSPECTION');

    pr = beginEvaluation(pr, NOW);
    expect(pr.state).toBe('EVALUATING');

    pr = applyRunResult(pr, run({ state: 'PASSED' }), LATER);
    expect(pr.state).toBe('PASSED');
    expect(pr.evaluatedDigests).toEqual(['a'.repeat(64)]);

    pr = mergePullRequest(pr, LATER);
    expect(pr.state).toBe('MERGED');
  });

  it('moves to FAILED when the run failed, not PASSED', () => {
    let pr = createPullRequestFromClaim('PR-1', issue(), claim(), NOW);
    pr = beginInspection(pr, NOW);
    pr = beginEvaluation(pr, NOW);
    pr = applyRunResult(pr, run({ state: 'FAILED', ciStatus: 1 }), LATER);
    expect(pr.state).toBe('FAILED');
  });

  it('refuses to skip straight from DRAFT to EVALUATING', () => {
    const pr = createPullRequestFromClaim('PR-1', issue(), claim(), NOW);
    expect(() => beginEvaluation(pr, NOW)).toThrow(/DRAFT/);
  });

  it('refuses to merge a pull request that has not reached PASSED', () => {
    const pr = createPullRequestFromClaim('PR-1', issue(), claim(), NOW);
    expect(() => mergePullRequest(pr, NOW)).toThrow();
  });

  it('refuses to merge a FAILED pull request', () => {
    let pr = createPullRequestFromClaim('PR-1', issue(), claim(), NOW);
    pr = beginInspection(pr, NOW);
    pr = beginEvaluation(pr, NOW);
    pr = applyRunResult(pr, run({ state: 'FAILED', ciStatus: 1 }), LATER);
    expect(() => mergePullRequest(pr, LATER)).toThrow();
  });

  it('does not record an empty digest (a rejected-before-hashing run) into evaluatedDigests', () => {
    let pr = createPullRequestFromClaim('PR-1', issue(), claim(), NOW);
    pr = beginInspection(pr, NOW);
    pr = beginEvaluation(pr, NOW);
    // Mirrors what runPipeline returns for a malformed submission: digest ''.
    pr = applyRunResult(pr, run({ state: 'FAILED', ciStatus: 1, digest: '' }), LATER);
    expect(pr.evaluatedDigests).toEqual([]);
  });

  it('does not duplicate a digest already recorded from a prior run', () => {
    let pr = createPullRequestFromClaim('PR-1', issue(), claim(), NOW);
    pr = { ...pr, evaluatedDigests: ['a'.repeat(64)] };
    pr = beginInspection(pr, NOW);
    pr = beginEvaluation(pr, NOW);
    pr = applyRunResult(pr, run({ state: 'PASSED', digest: 'a'.repeat(64) }), LATER);
    expect(pr.evaluatedDigests).toEqual(['a'.repeat(64)]);
  });
});

describe('allConditionsMet', () => {
  const passed = (id: string): ReleaseCondition => ({ id, label: id, status: 'PASSED', detail: '' });
  const pending = (id: string): ReleaseCondition => ({ id, label: id, status: 'PENDING', detail: '' });
  const failed = (id: string): ReleaseCondition => ({ id, label: id, status: 'FAILED', detail: '' });

  it('is true when every condition passed', () => {
    expect(allConditionsMet([passed('a'), passed('b')])).toBe(true);
  });

  it('is false when nothing was checked at all', () => {
    expect(allConditionsMet([])).toBe(false);
  });

  it('blocks on a single PENDING condition even when the rest passed', () => {
    // The exact bug this type exists to prevent: a mockup that marked
    // "Measurement rules passed" green while another rule still held
    // PENDING would read as release-ready. This must not.
    expect(allConditionsMet([passed('a'), pending('b'), passed('c')])).toBe(false);
  });

  it('blocks on a single FAILED condition even when the rest passed', () => {
    expect(allConditionsMet([passed('a'), failed('b')])).toBe(false);
  });
});
