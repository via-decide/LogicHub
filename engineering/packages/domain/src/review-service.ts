import { createLogicHubError } from '@logichub-engineering/shared';
import type { EngineeringPullRequest, ReviewRecord, PRStatus } from '@logichub-engineering/contracts';
import type { EngineeringPullRequestRepository } from '@logichub-engineering/persistence';
import { applyReview, nextPrStatus } from '@logichub-engineering/review-engine';
import { isoNow } from './id-generator.js';

export interface ReviewServiceDeps {
  pullRequestRepo: EngineeringPullRequestRepository;
  now?: () => string;
}

/**
 * Persistence-connected counterpart to review-engine's pure review-workflow
 * functions: appends the new review to the PR's approval/change-request
 * history and re-derives the PR's status (open / changes_requested /
 * approved), persisting only the transition that actually changed.
 *
 * A 'comment' decision does not mutate approvals/changeRequests or status --
 * EngineeringPullRequest's frozen contract (master spec section 10) has no
 * separate comment-log entity, so a comment is accepted (the call succeeds
 * and returns the unchanged PR) but is not currently persisted as its own
 * audit record.
 */
export class ReviewService {
  constructor(private readonly deps: ReviewServiceDeps) {}

  async submitReview(
    pullRequestId: string,
    reviewer: string,
    decision: ReviewRecord['decision'],
    comment?: string
  ): Promise<EngineeringPullRequest> {
    const now = this.deps.now ?? isoNow;
    const pr = await this.deps.pullRequestRepo.findById(pullRequestId);
    if (!pr) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Pull request ${pullRequestId} does not exist`, {
        entityIds: { pullRequestId },
      });
    }
    if (pr.status === 'merged' || pr.status === 'closed' || pr.status === 'rejected') {
      throw createLogicHubError('LH_STATE_TRANSITION_INVALID', `Pull request ${pullRequestId} is already ${pr.status}`, {
        entityIds: { pullRequestId },
      });
    }

    const review: ReviewRecord = { reviewer, decision, comment, createdAt: now() };
    const updatedHistory = applyReview({ approvals: pr.approvals, changeRequests: pr.changeRequests }, review);

    if (decision === 'approve') {
      await this.deps.pullRequestRepo.addApproval(pullRequestId, review);
    } else if (decision === 'request_changes') {
      await this.deps.pullRequestRepo.addChangeRequest(pullRequestId, review);
    }

    // nextPrStatus returns one legal hop of the frozen PullRequestTransitions
    // graph at a time (e.g. changes_requested can only reach 'open', not
    // 'approved', in a single hop) -- walk it until it stabilizes so a
    // single review submission can still cross more than one hop (e.g. the
    // last blocking reviewer approving should land on 'approved', not get
    // stuck at the intermediate 'open').
    let status: PRStatus = pr.status;
    for (let hop = 0; hop < 4; hop++) {
      const next = nextPrStatus(status, updatedHistory, pr.requiredApprovals);
      if (next === status) break;
      await this.deps.pullRequestRepo.updateStatus(pullRequestId, next);
      status = next;
    }
    if (status === pr.status) {
      await this.deps.pullRequestRepo.updateComputedFields(pullRequestId, { updatedAt: now() });
    }

    const updated = await this.deps.pullRequestRepo.findById(pullRequestId);
    if (!updated) {
      throw createLogicHubError('LH_INTERNAL_ERROR', `Pull request ${pullRequestId} disappeared immediately after review`, {
        entityIds: { pullRequestId },
      });
    }
    return updated;
  }

  /**
   * Closes a pull request without merging it. Not one of the endpoints
   * master spec section 12 names, but that list is explicitly a "minimum"
   * and section 13 requires a Close action alongside Comment/Approve/Request
   * changes/Recalculate/Merge -- PullRequestTransitions already allows
   * 'closed' from every non-terminal status, so this is a real, needed path.
   */
  async closePullRequest(pullRequestId: string): Promise<EngineeringPullRequest> {
    const now = this.deps.now ?? isoNow;
    const pr = await this.deps.pullRequestRepo.findById(pullRequestId);
    if (!pr) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Pull request ${pullRequestId} does not exist`, {
        entityIds: { pullRequestId },
      });
    }
    if (pr.status === 'merged' || pr.status === 'closed' || pr.status === 'rejected') {
      throw createLogicHubError('LH_STATE_TRANSITION_INVALID', `Pull request ${pullRequestId} is already ${pr.status}`, {
        entityIds: { pullRequestId },
      });
    }
    await this.deps.pullRequestRepo.updateStatus(pullRequestId, 'closed');
    await this.deps.pullRequestRepo.updateComputedFields(pullRequestId, { updatedAt: now() });

    const updated = await this.deps.pullRequestRepo.findById(pullRequestId);
    if (!updated) {
      throw createLogicHubError('LH_INTERNAL_ERROR', `Pull request ${pullRequestId} disappeared immediately after close`, {
        entityIds: { pullRequestId },
      });
    }
    return updated;
  }
}
