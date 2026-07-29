import type {
  ProjectId, RevisionId, EngineeringObjectId, ConstraintId,
  DecisionId, ArtifactId, ChangeIntentId, ValidationResultId,
  ModuleId, EngineeringPullRequestId,
} from '@logichub-engineering/shared';
import type {
  Project, Revision, EngineeringObject, Constraint,
  Decision, Artifact, ChangeIntent, ValidationResult,
  Module, EngineeringPullRequest, ReviewRecord,
  RevisionStatus, ChangeIntentStatus, PRStatus,
} from '@logichub-engineering/contracts';

export interface ProjectRepository {
  create(project: Project): Promise<void>;
  findById(id: ProjectId): Promise<Project | null>;
  findBySlug(slug: string): Promise<Project | null>;
  listAll(): Promise<Project[]>;
  update(id: ProjectId, fields: Partial<Pick<Project, 'name' | 'description' | 'status' | 'updatedAt' | 'metadata'>>): Promise<void>;
}

export interface RevisionRepository {
  create(revision: Revision): Promise<void>;
  findById(id: RevisionId): Promise<Revision | null>;
  findByProjectId(projectId: ProjectId): Promise<Revision[]>;
  findByGitCommitSha(projectId: ProjectId, sha: string): Promise<Revision | null>;
  findByBranch(projectId: ProjectId, branchName: string): Promise<Revision[]>;
  updateStatus(id: RevisionId, newStatus: RevisionStatus): Promise<void>;
  setSnapshotHashes(id: RevisionId, hashes: {
    snapshotHash: string;
    engineeringObjectSnapshotHash: string;
    constraintSnapshotHash: string;
    decisionSnapshotHash: string;
    bomSnapshotHash: string;
    artifactManifestHash: string;
  }): Promise<void>;
}

export interface EngineeringObjectRepository {
  create(obj: EngineeringObject): Promise<void>;
  createMany(objects: EngineeringObject[]): Promise<void>;
  findById(id: EngineeringObjectId): Promise<EngineeringObject | null>;
  findByRevisionId(revisionId: RevisionId): Promise<EngineeringObject[]>;
  findBySemanticKey(revisionId: RevisionId, semanticKey: string): Promise<EngineeringObject | null>;
  findByType(revisionId: RevisionId, objectType: string): Promise<EngineeringObject[]>;
}

export interface ConstraintRepository {
  create(constraint: Constraint): Promise<void>;
  findById(id: ConstraintId): Promise<Constraint | null>;
  findByRevisionId(revisionId: RevisionId): Promise<Constraint[]>;
  update(id: ConstraintId, fields: Partial<Pick<Constraint, 'evaluation' | 'status' | 'updatedAt' | 'metadata'>>): Promise<void>;
}

export interface DecisionRepository {
  create(decision: Decision): Promise<void>;
  findById(id: DecisionId): Promise<Decision | null>;
  findByRevisionId(revisionId: RevisionId): Promise<Decision[]>;
}

export interface ArtifactRepository {
  create(artifact: Artifact): Promise<void>;
  findById(id: ArtifactId): Promise<Artifact | null>;
  findByRevisionId(revisionId: RevisionId): Promise<Artifact[]>;
  findBySha256(sha256: string): Promise<Artifact[]>;
}

export interface ChangeIntentRepository {
  create(intent: ChangeIntent): Promise<void>;
  findById(id: ChangeIntentId): Promise<ChangeIntent | null>;
  findByProjectId(projectId: ProjectId): Promise<ChangeIntent[]>;
  updateStatus(id: ChangeIntentId, newStatus: ChangeIntentStatus): Promise<void>;
}

export interface ValidationResultRepository {
  create(result: ValidationResult): Promise<void>;
  findById(id: ValidationResultId): Promise<ValidationResult | null>;
  findByRevisionId(revisionId: RevisionId): Promise<ValidationResult[]>;
}

export interface ModuleRepository {
  create(module: Module): Promise<void>;
  findById(id: ModuleId): Promise<Module | null>;
  findByNamespaceAndName(namespace: string, name: string): Promise<Module[]>;
  listAll(): Promise<Module[]>;
}

export interface EngineeringPullRequestRepository {
  create(pr: EngineeringPullRequest): Promise<void>;
  findById(id: EngineeringPullRequestId): Promise<EngineeringPullRequest | null>;
  findByProjectId(projectId: ProjectId): Promise<EngineeringPullRequest[]>;
  findByNumber(projectId: ProjectId, number: number): Promise<EngineeringPullRequest | null>;
  updateStatus(id: EngineeringPullRequestId, newStatus: PRStatus): Promise<void>;
  updateComputedFields(id: EngineeringPullRequestId, fields: Partial<Pick<EngineeringPullRequest,
    'diffSummary' | 'validationSummary' | 'constraintSummary' | 'mergeEligibility' |
    'updatedAt' | 'mergedAt' | 'mergedRevisionId' | 'metadata'
  >>): Promise<void>;
  addApproval(id: EngineeringPullRequestId, review: ReviewRecord): Promise<void>;
  addChangeRequest(id: EngineeringPullRequestId, review: ReviewRecord): Promise<void>;
}
