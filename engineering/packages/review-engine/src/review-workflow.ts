import type { ReviewRecord, PRStatus } from '@logichub-engineering/contracts';

export interface ReviewHistory {
  approvals: ReviewRecord[];
  changeRequests: ReviewRecord[];
}

export interface ReviewStateSummary {
  approvalCount: number;
  unresolvedChangeRequests: ReviewRecord[];
}

/**
 * Appends one new review decision to the PR's existing history. Pure: the
 * caller (domain, via EngineeringPullRequestRepository.addApproval /
 * addChangeRequest) is responsible for persisting the result. A 'comment'
 * decision changes neither list -- comments are not tracked as review
 * decisions in the approvals/changeRequests arrays.
 */
export function applyReview(existing: ReviewHistory, review: ReviewRecord): ReviewHistory {
  if (review.decision === 'approve') {
    return { approvals: [...existing.approvals, review], changeRequests: existing.changeRequests };
  }
  if (review.decision === 'request_changes') {
    return { approvals: existing.approvals, changeRequests: [...existing.changeRequests, review] };
  }
  return existing;
}

/**
 * A reviewer's most recent decision supersedes their earlier ones: a later
 * approval resolves an earlier request_changes from the same reviewer, and a
 * later request_changes revokes an earlier approval. approvalCount and
 * unresolvedChangeRequests are both computed on this latest-per-reviewer
 * basis, never on raw array length.
 */
export function summarizeReviewState(history: ReviewHistory): ReviewStateSummary {
  const latestByReviewer = new Map<string, ReviewRecord>();
  const chronological = [...history.approvals, ...history.changeRequests].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  for (const record of chronological) {
    latestByReviewer.set(record.reviewer, record);
  }
  const latest = [...latestByReviewer.values()];
  return {
    approvalCount: latest.filter((r) => r.decision === 'approve').length,
    unresolvedChangeRequests: latest.filter((r) => r.decision === 'request_changes'),
  };
}

/**
 * One legal hop of the frozen PullRequestTransitions graph (master spec
 * section 16: draft -> open -> changes_requested -> open -> approved ->
 * merged), given the PR's current review history. Never reverts a terminal
 * status, and never reverts 'approved' back down -- that edge does not exist
 * in the graph. A request_changes submitted after a PR is already 'approved'
 * still updates the review history (and therefore still blocks merge gate
 * #14, recalculated fresh at merge time), it just does not change the
 * coarse status label back down; the caller (domain's ReviewService) walks
 * this function repeatedly to cross more than one hop in a single review
 * submission (e.g. changes_requested -> open -> approved).
 */
export function nextPrStatus(current: PRStatus, history: ReviewHistory, requiredApprovals: number): PRStatus {
  if (current === 'merged' || current === 'closed' || current === 'rejected' || current === 'approved') {
    return current;
  }
  const summary = summarizeReviewState(history);
  if (current === 'changes_requested') {
    return summary.unresolvedChangeRequests.length > 0 ? 'changes_requested' : 'open';
  }
  // draft or open
  if (summary.unresolvedChangeRequests.length > 0) return 'changes_requested';
  if (summary.approvalCount >= requiredApprovals) return 'approved';
  return current;
}
