import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogicHubError } from '@logichub-engineering/shared';
import type {
  Revision,
  EngineeringObject,
  Artifact,
  ValidationResult,
} from '@logichub-engineering/contracts';
import type {
  ProjectRepository,
  RevisionRepository,
  EngineeringObjectRepository,
  ArtifactRepository,
  ValidationResultRepository,
} from '@logichub-engineering/persistence';
import { computeSnapshotHashes } from '@logichub-engineering/persistence';
import type { ArtifactStore } from '@logichub-engineering/artifact-store';
import { GitRepository } from '@logichub-engineering/git-adapter';
import { KicadAdapter, type BomItem, type ExtractionContext } from '@logichub-engineering/kicad-adapter';
import { buildFingerprint, type FingerprintResult } from '@logichub-engineering/repository-engine';
import { generateId, isoNow } from './id-generator.js';

export interface ImportServiceDeps {
  projectRepo: ProjectRepository;
  revisionRepo: RevisionRepository;
  objectRepo: EngineeringObjectRepository;
  artifactRepo: ArtifactRepository;
  validationResultRepo: ValidationResultRepository;
  artifactStore: ArtifactStore;
  kicad?: KicadAdapter;
  now?: () => string;
  generateId?: (prefix: string) => string;
}

export interface ImportRevisionInput {
  projectId: string;
  /** Local path to a git repository git-adapter can open. */
  repoPath: string;
  /** Branch or commit-ish to resolve and import. */
  ref: string;
  /** Logical branch name to record on the persisted Revision. */
  branchName: string;
  author: string;
  message: string;
}

export interface ImportRevisionResult {
  revision: Revision;
  objects: EngineeringObject[];
  bomItems: BomItem[];
  fingerprint: FingerprintResult;
  validationResults: ValidationResult[];
  artifacts: Artifact[];
}

/**
 * Orchestrates the KiCad import pipeline documented in
 * docs/workflows/kicad-import.md: resolve the git ref, extract semantic
 * objects + BOM via kicad-adapter, build the whole-repo fingerprint via
 * repository-engine (needed later for diffing), generate render/ERC/DRC
 * evidence when the toolchain is available, and persist everything as one
 * revision. This composes already-tested library calls; it adds no new
 * parsing, hashing, or diffing logic of its own.
 */
export class ImportService {
  private readonly kicad: KicadAdapter;

  constructor(private readonly deps: ImportServiceDeps) {
    this.kicad = deps.kicad ?? new KicadAdapter();
  }

  async importRevision(input: ImportRevisionInput): Promise<ImportRevisionResult> {
    const now = this.deps.now ?? isoNow;
    const genId = this.deps.generateId ?? generateId;

    const project = await this.deps.projectRepo.findById(input.projectId);
    if (!project) {
      throw createLogicHubError('LH_PROJECT_NOT_FOUND', `Project ${input.projectId} does not exist`, {
        entityIds: { projectId: input.projectId },
      });
    }

    const git = await GitRepository.open(input.repoPath);
    const commitSha = await git.resolveCommitSha(input.ref);

    const existing = await this.deps.revisionRepo.findByGitCommitSha(input.projectId, commitSha);
    if (existing) {
      throw createLogicHubError(
        'LH_REVISION_ALREADY_IMPORTED',
        `Commit ${commitSha} was already imported as revision ${existing.id}`,
        { entityIds: { projectId: input.projectId, revisionId: existing.id, commitSha } }
      );
    }

    const commitMeta = await git.readCommitMetadata(commitSha);
    const revisionId = genId('rev');
    const createdAt = now();

    // Materialize the commit's tree into an isolated working tree so
    // kicad-adapter can operate on real files without touching the caller's
    // checkout (mirrors the isolation guarantee kicad-adapter itself uses
    // for its own CLI operations).
    const workDir = await mkdtemp(join(tmpdir(), 'logichub-import-'));
    let objects: EngineeringObject[] = [];
    let bomItems: BomItem[] = [];
    const validationResults: ValidationResult[] = [];
    const artifacts: Artifact[] = [];
    let fingerprint: FingerprintResult;

    try {
      await git.restoreWorkingTree(commitSha, workDir);

      const files = await this.kicad.inspectProject(workDir);
      const projectValidation = await this.kicad.validateProjectFiles(files);

      const ctx: ExtractionContext = { projectId: input.projectId, revisionId, createdAt };

      if (files.schematicFile) {
        objects.push(...(await this.kicad.extractSchematicObjects(ctx, files.schematicFile)));
        const bomResult = await this.kicad.extractBom(ctx, files.schematicFile);
        bomItems = bomResult.items;
        objects.push(...bomResult.objects);
      }
      if (files.pcbFile) {
        objects.push(...(await this.kicad.extractPcbObjects(ctx, files.pcbFile)));
      }

      fingerprint = await buildFingerprint({ repoPath: input.repoPath, commitRef: commitSha });

      const kicadImportValidationId = genId('val');
      validationResults.push({
        id: kicadImportValidationId,
        schemaVersion: '0.1.0',
        projectId: input.projectId,
        revisionId,
        validator: 'kicad-adapter.validateProjectFiles',
        validatorVersion: '0.1.0',
        validationType: 'kicad_import',
        status: projectValidation.valid ? 'pass' : 'fail',
        startedAt: createdAt,
        completedAt: now(),
        diagnostics: projectValidation.diagnostics,
        artifactIds: [],
        createdAt: now(),
        metadata: {},
      });

      if (files.schematicFile && files.pcbFile) {
        const erc = await this.kicad.runErc(files);
        const ercArtifacts = await this.storeCheckReport(input.projectId, revisionId, 'erc_report', erc.report, now);
        artifacts.push(...ercArtifacts);
        validationResults.push(
          this.checkResultToValidationResult(genId, input.projectId, revisionId, 'erc', erc, createdAt, now(), ercArtifacts)
        );

        const drc = await this.kicad.runDrc(files);
        const drcArtifacts = await this.storeCheckReport(input.projectId, revisionId, 'drc_report', drc.report, now);
        artifacts.push(...drcArtifacts);
        validationResults.push(
          this.checkResultToValidationResult(genId, input.projectId, revisionId, 'drc', drc, createdAt, now(), drcArtifacts)
        );
      }
    } finally {
      await git.removeWorkingTree(workDir).catch(() => undefined);
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }

    const snapshotHashes = computeSnapshotHashes({
      engineeringObjects: objects,
      constraints: [],
      decisions: [],
      bomItems: objects.filter((o) => o.objectType === 'bom_item'),
      artifacts,
    });

    const revision: Revision = {
      id: revisionId,
      schemaVersion: '0.1.0',
      projectId: input.projectId,
      gitCommitSha: commitSha,
      branchName: input.branchName,
      parentRevisionIds: [],
      author: input.author || commitMeta.authorName,
      message: input.message || commitMeta.message,
      createdAt,
      toolchain: {},
      status: 'imported',
      metadata: {},
      ...snapshotHashes,
    };

    await this.deps.revisionRepo.create(revision);
    if (objects.length > 0) {
      await this.deps.objectRepo.createMany(objects);
    }
    for (const artifact of artifacts) {
      await this.deps.artifactRepo.create(artifact);
    }
    for (const result of validationResults) {
      await this.deps.validationResultRepo.create(result);
    }

    return { revision, objects, bomItems, fingerprint, validationResults, artifacts };
  }

  private async storeCheckReport(
    projectId: string,
    revisionId: string,
    role: 'erc_report' | 'drc_report',
    report: Buffer | null,
    now: () => string
  ): Promise<Artifact[]> {
    if (!report) return [];
    const put = await this.deps.artifactStore.put(report, {
      mediaType: 'text/plain',
      createdAt: now(),
      filename: `${role}.txt`,
    });
    const artifact: Artifact = {
      id: generateId('art'),
      schemaVersion: '0.1.0',
      projectId,
      revisionId,
      role,
      filename: `${role}.txt`,
      mediaType: 'text/plain',
      byteSize: put.byteSize,
      sha256: put.sha256,
      storageKey: put.sha256,
      sourcePaths: [],
      generatedBy: 'kicad-adapter',
      createdAt: now(),
      metadata: {},
    };
    return [artifact];
  }

  private checkResultToValidationResult(
    genId: (prefix: string) => string,
    projectId: string,
    revisionId: string,
    kind: 'erc' | 'drc',
    check: { status: 'pass' | 'warning' | 'fail' | 'error' | 'skipped'; diagnostics: import('@logichub-engineering/kicad-adapter').FileDiagnostic[]; toolVersion: string | null },
    startedAt: string,
    completedAt: string,
    resultArtifacts: Artifact[]
  ): ValidationResult {
    return {
      id: genId('val'),
      schemaVersion: '0.1.0',
      projectId,
      revisionId,
      validator: `kicad-adapter.run${kind === 'erc' ? 'Erc' : 'Drc'}`,
      validatorVersion: check.toolVersion ?? 'unknown',
      validationType: kind,
      status: check.status === 'skipped' ? 'skipped' : check.status,
      startedAt,
      completedAt,
      diagnostics: check.diagnostics,
      artifactIds: resultArtifacts.map((a) => a.id),
      createdAt: completedAt,
      metadata: {},
    };
  }
}
