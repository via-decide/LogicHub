import { createLogicHubError } from '@logichub-engineering/shared';
import type { Revision, EngineeringPullRequest, Artifact } from '@logichub-engineering/contracts';
import type {
  RevisionRepository,
  EngineeringPullRequestRepository,
  ValidationResultRepository,
  ConstraintRepository,
  ArtifactRepository,
  DecisionRepository,
  EngineeringObjectRepository,
} from '@logichub-engineering/persistence';
import type { ArtifactStore } from '@logichub-engineering/artifact-store';
import { GitRepository } from '@logichub-engineering/git-adapter';
import { evaluateMergeGates, summarizeReviewState, type MergeGateInput, type MergeGateResult } from '@logichub-engineering/review-engine';
import { RevisionComparisonService } from './revision-comparison-service.js';
import { generateId, isoNow } from './id-generator.js';
import type { DomainEventSink } from './events.js';

export interface MergeServiceDeps {
  revisionRepo: RevisionRepository;
  pullRequestRepo: EngineeringPullRequestRepository;
  validationResultRepo: ValidationResultRepository;
  constraintRepo: ConstraintRepository;
  artifactRepo: ArtifactRepository;
  decisionRepo: DecisionRepository;
  objectRepo: EngineeringObjectRepository;
  artifactStore: ArtifactStore;
  now?: () => string;
  generateId?: (prefix: string) => string;
  /** Structured events per master spec section 19. No-op when omitted. */
  events?: DomainEventSink;
}

export interface MergePullRequestResult {
  pullRequest: EngineeringPullRequest;
  revision: Revision;
}

/**
 * Gathers real MergeGateInput from persistence + git-adapter + the diff/
 * constraint pipeline and calls review-engine's pure evaluateMergeGates
 * (ADR-0003: this is the thin orchestration wrapper the master spec
 * describes -- gate policy stays in review-engine, only I/O lives here).
 */
export class MergeService {
  constructor(private readonly deps: MergeServiceDeps) {}

  /** Master spec section 11: merge eligibility must be recalculatable on demand, never trusting a stale cached result. */
  async recalculateEligibility(pullRequestId: string, repoPath: string): Promise<MergeGateResult> {
    const pr = await this.requirePullRequest(pullRequestId);
    const input = await this.buildGateInput(pr, repoPath);
    const result = evaluateMergeGates(input);

    const now = this.deps.now ?? isoNow;
    await this.deps.pullRequestRepo.updateComputedFields(pr.id, {
      mergeEligibility: { eligible: result.eligible, blockers: result.blockers },
      updatedAt: now(),
    });

    return result;
  }

  async mergePullRequest(pullRequestId: string, repoPath: string, mergedBy: string): Promise<MergePullRequestResult> {
    const now = this.deps.now ?? isoNow;
    const genId = this.deps.generateId ?? generateId;

    const pr = await this.requirePullRequest(pullRequestId);
    if (pr.status === 'merged' || pr.status === 'closed' || pr.status === 'rejected') {
      throw createLogicHubError('LH_STATE_TRANSITION_INVALID', `Pull request ${pullRequestId} is already ${pr.status}`, {
        entityIds: { pullRequestId },
      });
    }
    // Recalculate immediately before merging -- never trust an earlier cached mergeEligibility.
    const input = await this.buildGateInput(pr, repoPath);
    const preCheck = evaluateMergeGates(input);
    if (!preCheck.eligible) {
      await this.deps.pullRequestRepo.updateComputedFields(pr.id, {
        mergeEligibility: { eligible: false, blockers: preCheck.blockers },
        updatedAt: now(),
      });
      this.deps.events?.({
        name: 'pull_request.merge_blocked',
        timestamp: now(),
        pullRequestId,
        actor: mergedBy,
        result: 'failure',
        metadata: { blockers: preCheck.blockers },
      });
      throw createLogicHubError('LH_MERGE_BLOCKED', `Pull request ${pullRequestId} does not satisfy merge gates`, {
        entityIds: { pullRequestId },
        diagnostics: { blockers: preCheck.blockers },
      });
    }

    const headRevision = await this.deps.revisionRepo.findById(pr.headRevisionId);
    if (!headRevision) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Revision ${pr.headRevisionId} does not exist`, {
        entityIds: { revisionId: pr.headRevisionId },
      });
    }

    const git = await GitRepository.open(repoPath);
    const mergeResult = await git.merge(pr.baseBranch, headRevision.gitCommitSha, {
      message: `Merge PR #${pr.number}: ${pr.title}`,
      authorName: mergedBy,
      authorEmail: `${mergedBy}@logichub.local`,
    });

    const mergedAt = now();
    const mergeRevision: Revision = {
      id: genId('rev'),
      schemaVersion: '0.1.0',
      projectId: pr.projectId,
      gitCommitSha: mergeResult.sha,
      branchName: pr.baseBranch,
      parentRevisionIds: [pr.baseRevisionId, pr.headRevisionId],
      author: mergedBy,
      message: `Merge PR #${pr.number}: ${pr.title}`,
      createdAt: mergedAt,
      // A merge produced by git-adapter's fast-forward-when-possible merge()
      // carries head's tree, so head's already-computed snapshot hashes
      // describe this revision's content too.
      snapshotHash: headRevision.snapshotHash,
      engineeringObjectSnapshotHash: headRevision.engineeringObjectSnapshotHash,
      constraintSnapshotHash: headRevision.constraintSnapshotHash,
      decisionSnapshotHash: headRevision.decisionSnapshotHash,
      bomSnapshotHash: headRevision.bomSnapshotHash,
      artifactManifestHash: headRevision.artifactManifestHash,
      toolchain: headRevision.toolchain,
      status: 'merged',
      metadata: { mergedPullRequestId: pr.id },
    };
    await this.deps.revisionRepo.create(mergeRevision);

    // Gate 16 ("the merge operation produces a new immutable revision") is
    // only decidable now that the merge actually ran -- re-evaluate with the
    // postcondition observed, satisfied because mergeRevision was just
    // persisted above.
    const postMergeResult = evaluateMergeGates({ ...input, mergeProducedRevision: true });
    await this.deps.pullRequestRepo.updateComputedFields(pr.id, {
      mergeEligibility: { eligible: postMergeResult.eligible, blockers: postMergeResult.blockers },
      mergedAt,
      mergedRevisionId: mergeRevision.id,
      updatedAt: mergedAt,
    });
    await this.deps.pullRequestRepo.updateStatus(pr.id, 'merged');
    this.deps.events?.({
      name: 'pull_request.merged',
      timestamp: mergedAt,
      pullRequestId,
      revisionId: mergeRevision.id,
      actor: mergedBy,
      result: 'success',
    });

    const updated = await this.deps.pullRequestRepo.findById(pr.id);
    if (!updated) {
      throw createLogicHubError('LH_INTERNAL_ERROR', `Pull request ${pr.id} disappeared immediately after merge`, {
        entityIds: { pullRequestId: pr.id },
      });
    }

    return { pullRequest: updated, revision: mergeRevision };
  }

  private async requirePullRequest(pullRequestId: string): Promise<EngineeringPullRequest> {
    const pr = await this.deps.pullRequestRepo.findById(pullRequestId);
    if (!pr) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Pull request ${pullRequestId} does not exist`, {
        entityIds: { pullRequestId },
      });
    }
    return pr;
  }

  private async buildGateInput(pr: EngineeringPullRequest, repoPath: string): Promise<MergeGateInput> {
    const [baseRevision, headRevision] = await Promise.all([
      this.deps.revisionRepo.findById(pr.baseRevisionId),
      this.deps.revisionRepo.findById(pr.headRevisionId),
    ]);
    if (!baseRevision) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Revision ${pr.baseRevisionId} does not exist`, {
        entityIds: { revisionId: pr.baseRevisionId },
      });
    }
    if (!headRevision) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Revision ${pr.headRevisionId} does not exist`, {
        entityIds: { revisionId: pr.headRevisionId },
      });
    }

    const git = await GitRepository.open(repoPath);
    const [headDescendsFromBase, staleCheck, repoState] = await Promise.all([
      git.isAncestor(baseRevision.gitCommitSha, headRevision.gitCommitSha),
      git.checkStaleBase(pr.baseBranch, baseRevision.gitCommitSha),
      git.validateState(),
    ]);

    const comparisonService = new RevisionComparisonService({
      revisionRepo: this.deps.revisionRepo,
      objectRepo: this.deps.objectRepo,
      constraintRepo: this.deps.constraintRepo,
      artifactRepo: this.deps.artifactRepo,
      artifactStore: this.deps.artifactStore,
    });
    const comparison = await comparisonService.compareRevisions(repoPath, pr.baseRevisionId, pr.headRevisionId);

    const validationResults = await this.deps.validationResultRepo.findByRevisionId(pr.headRevisionId);
    const kicadImport = validationResults.find((v) => v.validationType === 'kicad_import');
    const erc = validationResults.find((v) => v.validationType === 'erc');
    const drc = validationResults.find((v) => v.validationType === 'drc');
    const schemaResults = validationResults.filter((v) => v.validationType === 'schema');
    // A 'skipped' evidence status (kicad-cli unavailable) is honestly
    // "unknown", never treated as a blocking ERC/DRC failure -- gate 11
    // exists precisely to catch missing evidence.
    const hasUnknownRequiredValidation = validationResults.some((v) => v.status === 'unknown' || v.status === 'skipped');

    const decisions = await this.deps.decisionRepo.findByRevisionId(pr.headRevisionId);
    const requiredDecisionsPresent = !(
      comparison.semDiff.prSummary.reviewDomainsRequired.includes('decision') && decisions.length === 0
    );

    const artifacts = await this.deps.artifactRepo.findByRevisionId(pr.headRevisionId);
    const artifactHashesValid = await this.allArtifactsVerify(artifacts);

    const reviewSummary = summarizeReviewState({ approvals: pr.approvals, changeRequests: pr.changeRequests });

    return {
      baseProjectId: baseRevision.projectId,
      headProjectId: headRevision.projectId,
      headDescendsFromBase,
      baseIsStale: staleCheck.stale,
      // Reaching this point means both revisions' fingerprints were readable
      // from git and, when a cached revision_manifest artifact existed, it
      // passed hash verification (RevisionComparisonService never trusts an
      // unverified cache -- see its own doc comment).
      manifestIntegrityValid: true,
      artifactHashesValid,
      schemaValidationsPassed: schemaResults.length === 0 || schemaResults.every((v) => v.status === 'pass'),
      kicadImportValidationPassed: kicadImport?.status === 'pass',
      ercHasBlockingFailures: erc ? erc.status === 'fail' || erc.status === 'error' : false,
      drcHasBlockingFailures: drc ? drc.status === 'fail' || drc.status === 'error' : false,
      hasBlockingConstraintViolation: comparison.hasBlockingConstraintViolation,
      hasUnknownRequiredValidation,
      requiredDecisionsPresent,
      requiredApprovals: pr.requiredApprovals,
      approvalCount: reviewSummary.approvalCount,
      hasUnresolvedRequestChanges: reviewSummary.unresolvedChangeRequests.length > 0,
      workingTreeClean: repoState.clean,
    };
  }

  private async allArtifactsVerify(artifacts: Artifact[]): Promise<boolean> {
    if (artifacts.length === 0) return true;
    const results = await Promise.all(artifacts.map((a) => this.deps.artifactStore.verify(a.sha256).catch(() => false)));
    return results.every(Boolean);
  }
}
