import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  RepositoryInfoSchema,
  ProjectVisibilitySchema,
  RequestedOperationSchema,
  ExpectedObjectChangeSchema,
  ChangeIntentConstraintRefSchema,
  ApprovalPolicySchema,
  ReviewDecisionSchema,
} from '@logichub-engineering/contracts';
import type { AppContext } from './app-context.js';
import { parsePageParams, paginate } from './pagination.js';

const CreateProjectBodySchema = z.object({
  slug: z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1).max(256),
  description: z.string().optional(),
  visibility: ProjectVisibilitySchema,
  repository: RepositoryInfoSchema,
  defaultBranch: z.string().optional(),
  createdBy: z.string().min(1),
});

const CreateProjectImportBodySchema = CreateProjectBodySchema.extend({
  ref: z.string().optional(),
  branchName: z.string().optional(),
  author: z.string().optional(),
  message: z.string().optional(),
});

const ImportRevisionBodySchema = z.object({
  ref: z.string().min(1),
  branchName: z.string().min(1),
  author: z.string().min(1),
  message: z.string().default(''),
});

const CreateBranchBodySchema = z.object({
  name: z.string().min(1),
  startPoint: z.string().min(1),
});

const CreateChangeIntentBodySchema = z.object({
  baseRevisionId: z.string().min(1),
  targetBranch: z.string().min(1),
  title: z.string().min(1),
  requestText: z.string().optional(),
  changeType: z.string().min(1),
  requestedOperations: z.array(RequestedOperationSchema).default([]),
  expectedObjectChanges: z.array(ExpectedObjectChangeSchema).default([]),
  preserve: z.array(z.string()).default([]),
  optimize: z.array(z.string()).default([]),
  constraints: z.array(ChangeIntentConstraintRefSchema).default([]),
  approvalPolicy: ApprovalPolicySchema,
  createdBy: z.string().min(1),
});

const CreatePullRequestBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  baseBranch: z.string().min(1),
  baseRevisionId: z.string().min(1),
  headBranch: z.string().min(1),
  headRevisionId: z.string().min(1),
  changeIntentId: z.string().optional(),
  author: z.string().min(1),
  requiredApprovals: z.number().int().min(1).optional(),
});

const SubmitReviewBodySchema = z.object({
  reviewer: z.string().min(1),
  decision: ReviewDecisionSchema,
  comment: z.string().optional(),
});

const MergePullRequestBodySchema = z.object({
  mergedBy: z.string().min(1),
});

const CreateModuleBodySchema = z.object({
  namespace: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  sourceProjectId: z.string().optional(),
  sourceRevisionId: z.string().optional(),
  interfaces: z.array(z.unknown()).default([]),
  requirements: z.array(z.string()).default([]),
  constraints: z.array(z.unknown()).default([]),
  dependencies: z.array(z.object({ moduleId: z.string(), versionConstraint: z.string() })).default([]),
  artifactIds: z.array(z.string()).default([]),
  bomItemIds: z.array(z.string()).default([]),
  license: z.string().optional(),
  maintainers: z.array(z.string()).default([]),
});

async function repoPathForProject(ctx: AppContext, projectId: string): Promise<string> {
  const project = await ctx.catalogService.getProject(projectId);
  return project.repository.localPath;
}

export function registerRoutes(app: FastifyInstance, ctx: AppContext): void {
  // ---- Projects ----
  app.post('/projects', async (request, reply) => {
    const body = CreateProjectBodySchema.parse(request.body);
    const project = await ctx.catalogService.createProject(body);
    reply.status(201).send(project);
  });

  app.post('/projects/import', async (request, reply) => {
    const body = CreateProjectImportBodySchema.parse(request.body);
    const project = await ctx.catalogService.createProject(body);
    const revisionImport = await ctx.importService.importRevision({
      projectId: project.id,
      repoPath: project.repository.localPath,
      ref: body.ref ?? project.defaultBranch,
      branchName: body.branchName ?? project.defaultBranch,
      author: body.author ?? body.createdBy,
      message: body.message ?? 'Initial import',
    });
    reply.status(201).send({ project, revision: revisionImport.revision });
  });

  app.get('/projects', async (request) => {
    const projects = await ctx.catalogService.listProjects();
    return paginate(projects, parsePageParams(request.query as Record<string, unknown>));
  });

  app.get('/projects/:projectId', async (request) => {
    const { projectId } = request.params as { projectId: string };
    return ctx.catalogService.getProject(projectId);
  });

  // ---- Branches ----
  app.get('/projects/:projectId/branches', async (request) => {
    const { projectId } = request.params as { projectId: string };
    return ctx.branchService.listBranches(projectId);
  });

  app.post('/projects/:projectId/branches', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = CreateBranchBodySchema.parse(request.body);
    const branch = await ctx.branchService.createBranch(projectId, body.name, body.startPoint);
    reply.status(201).send(branch);
  });

  // ---- Revisions ----
  app.post('/projects/:projectId/revisions/import', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = ImportRevisionBodySchema.parse(request.body);
    const repoPath = await repoPathForProject(ctx, projectId);
    const result = await ctx.importService.importRevision({ projectId, repoPath, ...body });
    reply.status(201).send(result.revision);
  });

  app.get('/projects/:projectId/revisions', async (request) => {
    const { projectId } = request.params as { projectId: string };
    const revisions = await ctx.catalogService.listRevisions(projectId);
    return paginate(revisions, parsePageParams(request.query as Record<string, unknown>));
  });

  app.get('/revisions/:revisionId', async (request) => {
    const { revisionId } = request.params as { revisionId: string };
    return ctx.catalogService.getRevision(revisionId);
  });

  // ---- Change intents ----
  app.post('/projects/:projectId/change-intents', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = CreateChangeIntentBodySchema.parse(request.body);
    const intent = await ctx.catalogService.createChangeIntent({ projectId, ...body });
    reply.status(201).send(intent);
  });

  app.get('/change-intents/:changeIntentId', async (request) => {
    const { changeIntentId } = request.params as { changeIntentId: string };
    return ctx.catalogService.getChangeIntent(changeIntentId);
  });

  // ---- Validation ----
  app.post('/revisions/:revisionId/validate', async (request, reply) => {
    const { revisionId } = request.params as { revisionId: string };
    const result = await ctx.catalogService.validateRevisionSchema(revisionId);
    reply.status(201).send(result);
  });

  app.get('/revisions/:revisionId/validations', async (request) => {
    const { revisionId } = request.params as { revisionId: string };
    const results = await ctx.catalogService.listValidations(revisionId);
    return paginate(results, parsePageParams(request.query as Record<string, unknown>));
  });

  // ---- Diff ----
  app.get('/revisions/:baseRevisionId/diff/:headRevisionId', async (request) => {
    const { baseRevisionId, headRevisionId } = request.params as { baseRevisionId: string; headRevisionId: string };
    const baseRevision = await ctx.catalogService.getRevision(baseRevisionId);
    const repoPath = await repoPathForProject(ctx, baseRevision.projectId);
    return ctx.comparisonService.compareRevisions(repoPath, baseRevisionId, headRevisionId);
  });

  // ---- Pull requests ----
  app.post('/projects/:projectId/pull-requests', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = CreatePullRequestBodySchema.parse(request.body);
    const pr = await ctx.catalogService.createPullRequest({ projectId, ...body });
    reply.status(201).send(pr);
  });

  app.get('/projects/:projectId/pull-requests', async (request) => {
    const { projectId } = request.params as { projectId: string };
    const prs = await ctx.catalogService.listPullRequests(projectId);
    return paginate(prs, parsePageParams(request.query as Record<string, unknown>));
  });

  app.get('/pull-requests/:pullRequestId', async (request) => {
    const { pullRequestId } = request.params as { pullRequestId: string };
    return ctx.catalogService.getPullRequest(pullRequestId);
  });

  app.post('/pull-requests/:pullRequestId/reviews', async (request, reply) => {
    const { pullRequestId } = request.params as { pullRequestId: string };
    const body = SubmitReviewBodySchema.parse(request.body);
    const pr = await ctx.reviewService.submitReview(pullRequestId, body.reviewer, body.decision, body.comment);
    reply.status(201).send(pr);
  });

  app.post('/pull-requests/:pullRequestId/recalculate', async (request) => {
    const { pullRequestId } = request.params as { pullRequestId: string };
    const pr = await ctx.catalogService.getPullRequest(pullRequestId);
    const repoPath = await repoPathForProject(ctx, pr.projectId);
    return ctx.mergeService.recalculateEligibility(pullRequestId, repoPath);
  });

  app.post('/pull-requests/:pullRequestId/merge', async (request) => {
    const { pullRequestId } = request.params as { pullRequestId: string };
    const body = MergePullRequestBodySchema.parse(request.body);
    const pr = await ctx.catalogService.getPullRequest(pullRequestId);
    const repoPath = await repoPathForProject(ctx, pr.projectId);
    return ctx.mergeService.mergePullRequest(pullRequestId, repoPath, body.mergedBy);
  });

  // ---- Artifacts ----
  app.get('/artifacts/:artifactId', async (request, reply) => {
    const { artifactId } = request.params as { artifactId: string };
    const artifact = await ctx.catalogService.getArtifact(artifactId);
    const wantsContent = (request.query as Record<string, unknown>).content === '1';
    if (!wantsContent) {
      return artifact;
    }
    const content = await ctx.artifactStore.get(artifact.sha256);
    if (!content) {
      reply.status(404);
      return { code: 'LH_ARTIFACT_NOT_FOUND', message: 'Artifact content is not present in the store.' };
    }
    reply.header('content-type', artifact.mediaType);
    reply.header('content-disposition', `inline; filename="${artifact.filename}"`);
    return reply.send(content);
  });

  // ---- Modules ----
  app.get('/modules', async (request) => {
    const modules = await ctx.catalogService.listModules();
    return paginate(modules, parsePageParams(request.query as Record<string, unknown>));
  });

  app.post('/modules', async (request, reply) => {
    const body = CreateModuleBodySchema.parse(request.body);
    const module = await ctx.catalogService.createModule(body);
    reply.status(201).send(module);
  });

  app.get('/modules/:moduleId', async (request) => {
    const { moduleId } = request.params as { moduleId: string };
    return ctx.catalogService.getModule(moduleId);
  });
}
