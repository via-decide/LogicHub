import type {
  Project,
  Revision,
  EngineeringPullRequest,
  ValidationResult,
  Constraint,
  Module,
  Artifact,
  ChangeIntent,
} from "@logichub-engineering/contracts";

export type {
  Project,
  Revision,
  EngineeringPullRequest,
  ValidationResult,
  Constraint,
  Module,
  Artifact,
  ChangeIntent,
};

export interface PageResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface BranchInfo {
  name: string;
  headSha: string;
}

export interface DeltaRecord {
  deltaType: string;
  domain: string;
  oldSemanticId: string | null;
  newSemanticId: string | null;
  classificationBasis: string;
  reviewDomains: string[];
}

export interface EngineeringPrSummary {
  changeCountsByDomain: Record<string, number>;
  changeCountsByType: Record<string, number>;
  breakingSoftwareChanges: string[];
  changedNets: string[];
  changedComponentMappings: string[];
  bomRiskChanges: string[];
  affectedBlockingConstraints: string[];
  validationsRequired: string[];
  reviewDomainsRequired: string[];
  unknownMappings: string[];
  deterministicMergeBlockers: string[];
}

export interface SemDiffResult {
  deltas: DeltaRecord[];
  replayVerified: boolean;
  replayErrors: string[];
  prSummary: EngineeringPrSummary;
}

export interface ConstraintEvaluationOutcome {
  constraintId: string;
  evaluation: "pass" | "warning" | "violation" | "unknown" | "requires_validation" | "error";
  reason: string;
}

export interface RevisionComparisonResult {
  baseRevision: Revision;
  headRevision: Revision;
  semDiff: SemDiffResult;
  constraints: Constraint[];
  constraintOutcomes: ConstraintEvaluationOutcome[];
  hasBlockingConstraintViolation: boolean;
}

export interface MergeGateCheck {
  gate: number;
  code: string;
  description: string;
  status: "pass" | "fail" | "pending";
}

export interface MergeBlocker {
  code: string;
  message: string;
}

export interface MergeGateResult {
  eligible: boolean;
  blockers: MergeBlocker[];
  checks: MergeGateCheck[];
}

export interface MergePullRequestResult {
  pullRequest: EngineeringPullRequest;
  revision: Revision;
}

export interface LogicHubErrorPayload {
  code: string;
  message: string;
  correlationId: string;
  retryable: boolean;
  entityIds?: Record<string, string>;
  diagnostics?: Record<string, unknown>;
}

export class LogicHubApiError extends Error {
  code: string;
  correlationId: string;
  status: number;

  constructor(payload: LogicHubErrorPayload, status: number) {
    super(payload.message);
    this.code = payload.code;
    this.correlationId = payload.correlationId;
    this.status = status;
  }
}

function apiBaseUrl(): string {
  return (
    process.env.LOGICHUB_API_URL ??
    process.env.NEXT_PUBLIC_LOGICHUB_API_URL ??
    "http://localhost:3000"
  );
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const body = json !== undefined ? JSON.stringify(json) : rest.body;
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...rest,
    cache: "no-store",
    // Only set content-type when there's actually a body -- Fastify's JSON
    // body parser rejects an empty body sent with content-type: application/json
    // (e.g. POST /pull-requests/:id/recalculate, which takes no payload) with
    // a 400, so this header must not be forced unconditionally.
    headers: body !== undefined ? { "content-type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body,
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({
      code: "LH_INTERNAL_ERROR",
      message: `Request to ${path} failed with status ${res.status}`,
      correlationId: "unknown",
      retryable: false,
    }))) as LogicHubErrorPayload;
    throw new LogicHubApiError(payload, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Projects ----
export const listProjects = (params?: { limit?: number; offset?: number }) =>
  request<PageResult<Project>>(`/projects?limit=${params?.limit ?? 50}&offset=${params?.offset ?? 0}`);

export const getProject = (projectId: string) => request<Project>(`/projects/${projectId}`);

export const createProject = (body: unknown) => request<Project>("/projects", { method: "POST", json: body });

// ---- Branches ----
export const listBranches = (projectId: string) =>
  request<BranchInfo[]>(`/projects/${projectId}/branches`);

// ---- Revisions ----
export const listRevisions = (projectId: string, params?: { limit?: number; offset?: number }) =>
  request<PageResult<Revision>>(
    `/projects/${projectId}/revisions?limit=${params?.limit ?? 50}&offset=${params?.offset ?? 0}`
  );

export const getRevision = (revisionId: string) => request<Revision>(`/revisions/${revisionId}`);

export const listValidations = (revisionId: string) =>
  request<PageResult<ValidationResult>>(`/revisions/${revisionId}/validations?limit=100`);

export const getDiff = (baseRevisionId: string, headRevisionId: string) =>
  request<RevisionComparisonResult>(`/revisions/${baseRevisionId}/diff/${headRevisionId}`);

// ---- Pull requests ----
export const listPullRequests = (projectId: string, params?: { limit?: number; offset?: number }) =>
  request<PageResult<EngineeringPullRequest>>(
    `/projects/${projectId}/pull-requests?limit=${params?.limit ?? 50}&offset=${params?.offset ?? 0}`
  );

export const getPullRequest = (pullRequestId: string) =>
  request<EngineeringPullRequest>(`/pull-requests/${pullRequestId}`);

export const submitReview = (
  pullRequestId: string,
  body: { reviewer: string; decision: "comment" | "approve" | "request_changes"; comment?: string }
) => request<EngineeringPullRequest>(`/pull-requests/${pullRequestId}/reviews`, { method: "POST", json: body });

export const recalculateEligibility = (pullRequestId: string) =>
  request<MergeGateResult>(`/pull-requests/${pullRequestId}/recalculate`, { method: "POST" });

export const mergePullRequest = (pullRequestId: string, mergedBy: string) =>
  request<MergePullRequestResult>(`/pull-requests/${pullRequestId}/merge`, {
    method: "POST",
    json: { mergedBy },
  });

export const closePullRequest = (pullRequestId: string) =>
  request<EngineeringPullRequest>(`/pull-requests/${pullRequestId}/close`, { method: "POST" });

// ---- Change intents ----
export const getChangeIntent = (changeIntentId: string) =>
  request<ChangeIntent>(`/change-intents/${changeIntentId}`);

// ---- Modules ----
export const listModules = (params?: { limit?: number; offset?: number }) =>
  request<PageResult<Module>>(`/modules?limit=${params?.limit ?? 50}&offset=${params?.offset ?? 0}`);

export { LogicHubApiError as ApiError };
