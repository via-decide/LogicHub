import { createLogicHubError } from '@logichub-engineering/shared';
import type { Revision, Artifact, Constraint } from '@logichub-engineering/contracts';
import type {
  RevisionRepository,
  EngineeringObjectRepository,
  ConstraintRepository,
  ArtifactRepository,
} from '@logichub-engineering/persistence';
import type { ArtifactStore } from '@logichub-engineering/artifact-store';
import {
  buildFingerprint,
  computeSemDiff,
  type FingerprintResult,
  type SemDiffResult,
} from '@logichub-engineering/repository-engine';
import { generateId, isoNow } from './id-generator.js';
import {
  evaluateConstraints,
  hasBlockingConstraintViolation,
  type ConstraintEvaluationOutcome,
} from './constraint-evaluation.js';

export interface RevisionComparisonDeps {
  revisionRepo: RevisionRepository;
  objectRepo: EngineeringObjectRepository;
  constraintRepo: ConstraintRepository;
  artifactRepo: ArtifactRepository;
  artifactStore: ArtifactStore;
  now?: () => string;
  generateId?: (prefix: string) => string;
}

export interface RevisionComparisonResult {
  baseRevision: Revision;
  headRevision: Revision;
  semDiff: SemDiffResult;
  constraints: Constraint[];
  constraintOutcomes: ConstraintEvaluationOutcome[];
  hasBlockingConstraintViolation: boolean;
}

/**
 * Compares two revisions of the same project's git repo. Fingerprints are
 * cached as a content-addressed `revision_manifest` artifact keyed by
 * revision id, since buildFingerprint re-walks and re-parses the whole repo
 * tree and that cost is otherwise paid on every comparison touching the same
 * revision. The cache is a plain hash-verified artifact (no separate cache
 * store), so a comparison always falls back to a full, correct rebuild if the
 * cached manifest is missing or fails hash verification — never trusts an
 * unverified cache. See docs/decisions/adr-0004-constraint-evaluation.md for
 * the constraint-evaluation half of this pipeline.
 */
export class RevisionComparisonService {
  constructor(private readonly deps: RevisionComparisonDeps) {}

  async compareRevisions(
    repoPath: string,
    baseRevisionId: string,
    headRevisionId: string
  ): Promise<RevisionComparisonResult> {
    const [baseRevision, headRevision] = await Promise.all([
      this.deps.revisionRepo.findById(baseRevisionId),
      this.deps.revisionRepo.findById(headRevisionId),
    ]);
    if (!baseRevision) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Revision ${baseRevisionId} does not exist`, {
        entityIds: { revisionId: baseRevisionId },
      });
    }
    if (!headRevision) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Revision ${headRevisionId} does not exist`, {
        entityIds: { revisionId: headRevisionId },
      });
    }
    if (baseRevision.projectId !== headRevision.projectId) {
      throw createLogicHubError(
        'LH_GIT_ANCESTRY_INVALID',
        `Revisions ${baseRevisionId} and ${headRevisionId} belong to different projects`,
        { entityIds: { baseRevisionId, headRevisionId } }
      );
    }

    const [baseFingerprint, headFingerprint] = await Promise.all([
      this.loadOrRebuildFingerprint(repoPath, baseRevision),
      this.loadOrRebuildFingerprint(repoPath, headRevision),
    ]);

    const semDiff = computeSemDiff({
      base: { fingerprint: baseFingerprint.descriptor, graphMap: null },
      proposed: { fingerprint: headFingerprint.descriptor, graphMap: null },
    });

    const targetObjects = await this.deps.objectRepo.findByRevisionId(headRevisionId);
    const constraints = await this.deps.constraintRepo.findByRevisionId(headRevisionId);
    const constraintOutcomes = evaluateConstraints(constraints, targetObjects, semDiff.deltas);
    const blockingViolation = hasBlockingConstraintViolation(constraints, constraintOutcomes);

    return {
      baseRevision,
      headRevision,
      semDiff,
      constraints,
      constraintOutcomes,
      hasBlockingConstraintViolation: blockingViolation,
    };
  }

  private async loadOrRebuildFingerprint(repoPath: string, revision: Revision): Promise<FingerprintResult> {
    const cached = await this.findCachedManifest(revision);
    if (cached) return cached;

    const result = await buildFingerprint({ repoPath, commitRef: revision.gitCommitSha });
    await this.cacheManifest(revision, result).catch(() => undefined);
    return result;
  }

  private async findCachedManifest(revision: Revision): Promise<FingerprintResult | null> {
    const artifacts = await this.deps.artifactRepo.findByRevisionId(revision.id);
    const manifest = artifacts.find((a) => a.role === 'revision_manifest');
    if (!manifest) return null;

    const verified = await this.deps.artifactStore.verify(manifest.sha256).catch(() => false);
    if (!verified) return null;

    const content = await this.deps.artifactStore.get(manifest.sha256);
    if (!content) return null;

    try {
      return JSON.parse(content.toString('utf-8')) as FingerprintResult;
    } catch {
      return null;
    }
  }

  private async cacheManifest(revision: Revision, result: FingerprintResult): Promise<void> {
    const now = this.deps.now ?? isoNow;
    const genId = this.deps.generateId ?? generateId;

    const buffer = Buffer.from(JSON.stringify(result), 'utf-8');
    const put = await this.deps.artifactStore.put(buffer, {
      mediaType: 'application/json',
      createdAt: now(),
      filename: 'revision-manifest.json',
    });

    const artifact: Artifact = {
      id: genId('art'),
      schemaVersion: '0.1.0',
      projectId: revision.projectId,
      revisionId: revision.id,
      role: 'revision_manifest',
      filename: 'revision-manifest.json',
      mediaType: 'application/json',
      byteSize: put.byteSize,
      sha256: put.sha256,
      storageKey: put.sha256,
      sourcePaths: [],
      generatedBy: 'repository-engine.buildFingerprint',
      createdAt: now(),
      metadata: {},
    };
    await this.deps.artifactRepo.create(artifact);
  }
}
