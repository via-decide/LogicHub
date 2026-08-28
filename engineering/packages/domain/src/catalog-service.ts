import { createLogicHubError } from '@logichub-engineering/shared';
import {
  EngineeringObjectSchema,
  type Project,
  type Revision,
  type ChangeIntent,
  type ValidationResult,
  type Diagnostic,
  type Artifact,
  type Module,
  type RepositoryInfo,
  type EngineeringPullRequest,
} from '@logichub-engineering/contracts';
import type {
  ProjectRepository,
  RevisionRepository,
  EngineeringObjectRepository,
  ChangeIntentRepository,
  ValidationResultRepository,
  ArtifactRepository,
  ModuleRepository,
  EngineeringPullRequestRepository,
} from '@logichub-engineering/persistence';
import { generateId, isoNow } from './id-generator.js';

export interface CatalogServiceDeps {
  projectRepo: ProjectRepository;
  revisionRepo: RevisionRepository;
  objectRepo: EngineeringObjectRepository;
  changeIntentRepo: ChangeIntentRepository;
  validationResultRepo: ValidationResultRepository;
  artifactRepo: ArtifactRepository;
  moduleRepo: ModuleRepository;
  pullRequestRepo: EngineeringPullRequestRepository;
  now?: () => string;
  generateId?: (prefix: string) => string;
}

export interface CreatePullRequestInput {
  projectId: string;
  title: string;
  description?: string;
  baseBranch: string;
  baseRevisionId: string;
  headBranch: string;
  headRevisionId: string;
  changeIntentId?: string;
  author: string;
  requiredApprovals?: number;
}

export interface CreateProjectInput {
  slug: string;
  name: string;
  description?: string;
  visibility: Project['visibility'];
  repository: RepositoryInfo;
  defaultBranch?: string;
  createdBy: string;
}

export interface CreateChangeIntentInput {
  projectId: string;
  baseRevisionId: string;
  targetBranch: string;
  title: string;
  requestText?: string;
  changeType: string;
  requestedOperations: ChangeIntent['requestedOperations'];
  expectedObjectChanges: ChangeIntent['expectedObjectChanges'];
  preserve: string[];
  optimize: string[];
  constraints: ChangeIntent['constraints'];
  approvalPolicy: ChangeIntent['approvalPolicy'];
  createdBy: string;
}

export interface CreateModuleInput {
  namespace: string;
  name: string;
  version: string;
  description?: string;
  sourceProjectId?: string;
  sourceRevisionId?: string;
  interfaces: unknown[];
  requirements: string[];
  constraints: unknown[];
  dependencies: Module['dependencies'];
  artifactIds: string[];
  bomItemIds: string[];
  license?: string;
  maintainers: string[];
}

/**
 * Straightforward, low-complexity orchestration over persistence: project
 * and module CRUD, revision/change-intent/validation reads, and ad hoc
 * schema (re-)validation. Kept in domain (not called directly from apps/api)
 * per ADR-0003 -- the API layer never imports persistence or any other
 * engine package itself, only domain.
 */
export class CatalogService {
  constructor(private readonly deps: CatalogServiceDeps) {}

  async createProject(input: CreateProjectInput): Promise<Project> {
    const now = this.deps.now ?? isoNow;
    const genId = this.deps.generateId ?? generateId;

    const existing = await this.deps.projectRepo.findBySlug(input.slug);
    if (existing) {
      throw createLogicHubError('LH_SCHEMA_INVALID', `A project with slug "${input.slug}" already exists`, {
        entityIds: { slug: input.slug },
      });
    }

    const project: Project = {
      id: genId('proj'),
      schemaVersion: '0.1.0',
      slug: input.slug,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      repository: input.repository,
      defaultBranch: input.defaultBranch ?? input.repository.defaultBranch,
      createdBy: input.createdBy,
      createdAt: now(),
      status: 'active',
      metadata: {},
    };
    await this.deps.projectRepo.create(project);
    return project;
  }

  async listProjects(): Promise<Project[]> {
    return this.deps.projectRepo.listAll();
  }

  async getProject(projectId: string): Promise<Project> {
    return this.requireProject(projectId);
  }

  async listRevisions(projectId: string): Promise<Revision[]> {
    await this.requireProject(projectId);
    return this.deps.revisionRepo.findByProjectId(projectId);
  }

  async getRevision(revisionId: string): Promise<Revision> {
    return this.requireRevision(revisionId);
  }

  async createChangeIntent(input: CreateChangeIntentInput): Promise<ChangeIntent> {
    const now = this.deps.now ?? isoNow;
    const genId = this.deps.generateId ?? generateId;
    await this.requireProject(input.projectId);
    await this.requireRevision(input.baseRevisionId);

    const intent: ChangeIntent = {
      id: genId('ci'),
      schemaVersion: '0.1.0',
      status: 'captured',
      createdAt: now(),
      ...input,
    };
    await this.deps.changeIntentRepo.create(intent);
    return intent;
  }

  async getChangeIntent(changeIntentId: string): Promise<ChangeIntent> {
    const intent = await this.deps.changeIntentRepo.findById(changeIntentId);
    if (!intent) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Change intent ${changeIntentId} does not exist`, {
        entityIds: { changeIntentId },
      });
    }
    return intent;
  }

  /** Re-validates every persisted EngineeringObject for a revision against its schema, independent of import-time validation. */
  async validateRevisionSchema(revisionId: string): Promise<ValidationResult> {
    const now = this.deps.now ?? isoNow;
    const genId = this.deps.generateId ?? generateId;
    const revision = await this.requireRevision(revisionId);
    const objects = await this.deps.objectRepo.findByRevisionId(revisionId);

    const diagnostics: Diagnostic[] = [];
    for (const obj of objects) {
      const result = EngineeringObjectSchema.safeParse(obj);
      if (!result.success) {
        diagnostics.push({ severity: 'error', message: `${obj.id}: ${result.error.message}` });
      }
    }

    const startedAt = now();
    const validationResult: ValidationResult = {
      id: genId('val'),
      schemaVersion: '0.1.0',
      projectId: revision.projectId,
      revisionId,
      validator: 'apps-api.schema-validation',
      validatorVersion: '0.1.0',
      validationType: 'schema',
      status: diagnostics.length === 0 ? 'pass' : 'fail',
      startedAt,
      completedAt: now(),
      diagnostics,
      artifactIds: [],
      createdAt: now(),
      metadata: {},
    };
    await this.deps.validationResultRepo.create(validationResult);
    return validationResult;
  }

  async listValidations(revisionId: string): Promise<ValidationResult[]> {
    await this.requireRevision(revisionId);
    return this.deps.validationResultRepo.findByRevisionId(revisionId);
  }

  async getArtifact(artifactId: string): Promise<Artifact> {
    const artifact = await this.deps.artifactRepo.findById(artifactId);
    if (!artifact) {
      throw createLogicHubError('LH_ARTIFACT_NOT_FOUND', `Artifact ${artifactId} does not exist`, {
        entityIds: { artifactId },
      });
    }
    return artifact;
  }

  async listModules(): Promise<Module[]> {
    return this.deps.moduleRepo.listAll();
  }

  async getModule(moduleId: string): Promise<Module> {
    const module = await this.deps.moduleRepo.findById(moduleId);
    if (!module) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Module ${moduleId} does not exist`, {
        entityIds: { moduleId },
      });
    }
    return module;
  }

  async createModule(input: CreateModuleInput): Promise<Module> {
    const now = this.deps.now ?? isoNow;
    const genId = this.deps.generateId ?? generateId;
    const module: Module = {
      id: genId('mod'),
      schemaVersion: '0.1.0',
      verificationStatus: 'unverified',
      createdAt: now(),
      ...input,
    };
    await this.deps.moduleRepo.create(module);
    return module;
  }

  async createPullRequest(input: CreatePullRequestInput): Promise<EngineeringPullRequest> {
    const now = this.deps.now ?? isoNow;
    const genId = this.deps.generateId ?? generateId;
    await this.requireProject(input.projectId);
    await this.requireRevision(input.baseRevisionId);
    await this.requireRevision(input.headRevisionId);

    const existing = await this.deps.pullRequestRepo.findByProjectId(input.projectId);
    const number = existing.reduce((max, pr) => Math.max(max, pr.number), 0) + 1;

    const pullRequest: EngineeringPullRequest = {
      id: genId('pr'),
      schemaVersion: '0.1.0',
      projectId: input.projectId,
      number,
      title: input.title,
      description: input.description,
      baseBranch: input.baseBranch,
      baseRevisionId: input.baseRevisionId,
      headBranch: input.headBranch,
      headRevisionId: input.headRevisionId,
      changeIntentId: input.changeIntentId,
      author: input.author,
      status: 'open',
      requiredApprovals: input.requiredApprovals ?? 1,
      approvals: [],
      changeRequests: [],
      createdAt: now(),
      metadata: {},
    };
    await this.deps.pullRequestRepo.create(pullRequest);
    return pullRequest;
  }

  async listPullRequests(projectId: string): Promise<EngineeringPullRequest[]> {
    await this.requireProject(projectId);
    return this.deps.pullRequestRepo.findByProjectId(projectId);
  }

  async getPullRequest(pullRequestId: string): Promise<EngineeringPullRequest> {
    const pr = await this.deps.pullRequestRepo.findById(pullRequestId);
    if (!pr) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Pull request ${pullRequestId} does not exist`, {
        entityIds: { pullRequestId },
      });
    }
    return pr;
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.deps.projectRepo.findById(projectId);
    if (!project) {
      throw createLogicHubError('LH_PROJECT_NOT_FOUND', `Project ${projectId} does not exist`, {
        entityIds: { projectId },
      });
    }
    return project;
  }

  private async requireRevision(revisionId: string): Promise<Revision> {
    const revision = await this.deps.revisionRepo.findById(revisionId);
    if (!revision) {
      throw createLogicHubError('LH_REVISION_NOT_FOUND', `Revision ${revisionId} does not exist`, {
        entityIds: { revisionId },
      });
    }
    return revision;
  }
}
