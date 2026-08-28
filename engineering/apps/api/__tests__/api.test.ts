import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { KicadAdapter, type KicadProjectFiles, type CheckResult } from '@logichub-engineering/kicad-adapter';
import { buildServer } from '../src/server.js';
import { createAppContext, type AppContext } from '../src/app-context.js';
import { createSmartPlantPotFixtureRepo, type FixtureRepo } from '../../../tests/helpers/fixture-repo.js';

function json(response: { json(): unknown }): any {
  return response.json();
}

/**
 * This sandbox has no kicad-cli, so a real KicadAdapter honestly reports
 * ERC/DRC as 'skipped' (kicad-adapter's own tests cover that convention).
 * This suite exercises the API layer's routing/validation/error-mapping --
 * not kicad-cli availability -- so ERC/DRC are simulated as available,
 * exactly like domain's own merge-service.test.ts does.
 */
class ToolchainAvailableKicadAdapter extends KicadAdapter {
  override async runErc(_files: KicadProjectFiles): Promise<CheckResult> {
    return { status: 'pass', diagnostics: [], report: null, toolVersion: 'test-fixture' };
  }
  override async runDrc(_files: KicadProjectFiles): Promise<CheckResult> {
    return { status: 'pass', diagnostics: [], report: null, toolVersion: 'test-fixture' };
  }
}

describe('apps/api golden path + invalid input + pagination', () => {
  let fixture: FixtureRepo;
  let artifactDir: string;
  let ctx: AppContext;
  let app: FastifyInstance;

  beforeAll(async () => {
    fixture = await createSmartPlantPotFixtureRepo();
    artifactDir = await mkdtemp(join(tmpdir(), 'logichub-api-artifacts-'));
    ctx = createAppContext({ dbPath: ':memory:', artifactStoreRoot: artifactDir, kicad: new ToolchainAvailableKicadAdapter() });
    app = buildServer({ context: ctx });
    await app.ready();
  }, 60000);

  afterAll(async () => {
    await app.close();
    await fixture.cleanup();
    await rm(artifactDir, { recursive: true, force: true });
  });

  it('every response carries a correlation ID', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects' });
    expect(res.headers['x-correlation-id']).toBeTruthy();
  });

  it('POST /projects: rejects an invalid slug with a typed LH_SCHEMA_INVALID error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: { slug: 'Not A Valid Slug!', name: 'x', visibility: 'private', repository: { provider: 'git', localPath: '/tmp/x', defaultBranch: 'main' }, createdBy: 'test' },
    });
    expect(res.statusCode).toBe(400);
    const body = json(res);
    expect(body.code).toBe('LH_SCHEMA_INVALID');
    expect(body.correlationId).toBeTruthy();
  });

  it('GET /projects/:projectId: 404s on an unknown project with a typed error, no internal paths leaked', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/does-not-exist' });
    expect(res.statusCode).toBe(404);
    const body = json(res);
    expect(body.code).toBe('LH_PROJECT_NOT_FOUND');
    expect(JSON.stringify(body)).not.toContain(tmpdir());
  });

  let projectId: string;
  let baseRevisionId: string;
  let headRevisionId: string;
  let pullRequestId: string;

  it('POST /projects: creates a project (golden path)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        slug: 'smart-plant-pot',
        name: 'Smart Plant Pot',
        visibility: 'private',
        repository: { provider: 'git', localPath: fixture.repoPath, defaultBranch: fixture.baseBranch },
        defaultBranch: fixture.baseBranch,
        createdBy: 'tester',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = json(res);
    expect(body.slug).toBe('smart-plant-pot');
    projectId = body.id;
  });

  it('GET /projects/:projectId/branches: lists the real git branches', async () => {
    const res = await app.inject({ method: 'GET', url: `/projects/${projectId}/branches` });
    expect(res.statusCode).toBe(200);
    const branches = json(res).map((b: { name: string }) => b.name);
    expect(branches).toContain(fixture.baseBranch);
    expect(branches).toContain(fixture.headBranch);
  });

  it('POST /projects/:projectId/revisions/import: imports the base and head revisions (golden path)', async () => {
    const baseRes = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/revisions/import`,
      payload: { ref: fixture.baseSha, branchName: fixture.baseBranch, author: 'tester', message: 'base' },
    });
    expect(baseRes.statusCode).toBe(201);
    baseRevisionId = json(baseRes).id;

    const headRes = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/revisions/import`,
      payload: { ref: fixture.headSha, branchName: fixture.headBranch, author: 'tester', message: 'proposed' },
    });
    expect(headRes.statusCode).toBe(201);
    headRevisionId = json(headRes).id;
  }, 30000);

  it('POST /projects/:projectId/revisions/import: rejects an unresolvable ref', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/revisions/import`,
      payload: { ref: 'this-branch-does-not-exist', branchName: 'x', author: 'tester', message: 'x' },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(json(res).code).toBeTruthy();
  });

  it('GET /revisions/:revisionId: fetches an imported revision', async () => {
    const res = await app.inject({ method: 'GET', url: `/revisions/${baseRevisionId}` });
    expect(res.statusCode).toBe(200);
    expect(json(res).gitCommitSha).toBe(fixture.baseSha);
  });

  it('POST /revisions/:revisionId/validate: re-runs schema validation', async () => {
    const res = await app.inject({ method: 'POST', url: `/revisions/${headRevisionId}/validate` });
    expect(res.statusCode).toBe(201);
    expect(json(res).status).toBe('pass');
  });

  it('GET /revisions/:revisionId/validations: lists validation results including kicad_import', async () => {
    const res = await app.inject({ method: 'GET', url: `/revisions/${headRevisionId}/validations` });
    expect(res.statusCode).toBe(200);
    const types = json(res).items.map((v: { validationType: string }) => v.validationType);
    expect(types).toContain('kicad_import');
    expect(types).toContain('schema');
  });

  it('GET /revisions/:base/diff/:head: computes the real semantic diff', async () => {
    const res = await app.inject({ method: 'GET', url: `/revisions/${baseRevisionId}/diff/${headRevisionId}` });
    expect(res.statusCode).toBe(200);
    const body = json(res);
    expect(body.semDiff.deltas.length).toBeGreaterThan(0);
    expect(body.semDiff.replayVerified).toBe(true);
  }, 30000);

  it('POST /projects/:projectId/pull-requests: opens a pull request (golden path)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/pull-requests`,
      payload: {
        title: 'Input protection + regulator swap',
        baseBranch: fixture.baseBranch,
        baseRevisionId,
        headBranch: fixture.headBranch,
        headRevisionId,
        author: 'tester',
        requiredApprovals: 1,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = json(res);
    expect(body.number).toBe(1);
    expect(body.status).toBe('open');
    pullRequestId = body.id;
  });

  it('POST /projects/:projectId/pull-requests: rejects a reference to a nonexistent revision', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/pull-requests`,
      payload: {
        title: 'x', baseBranch: 'main', baseRevisionId: 'not-a-real-revision',
        headBranch: 'feature', headRevisionId, author: 'tester',
      },
    });
    expect(res.statusCode).toBe(404);
    expect(json(res).code).toBe('LH_REVISION_NOT_FOUND');
  });

  it('POST /pull-requests/:id/recalculate: reports ineligible before any review', async () => {
    const res = await app.inject({ method: 'POST', url: `/pull-requests/${pullRequestId}/recalculate` });
    expect(res.statusCode).toBe(200);
    expect(json(res).eligible).toBe(false);
  }, 30000);

  it('POST /pull-requests/:id/merge: refuses while ineligible with a typed LH_MERGE_BLOCKED error', async () => {
    const res = await app.inject({ method: 'POST', url: `/pull-requests/${pullRequestId}/merge`, payload: { mergedBy: 'tester' } });
    expect(res.statusCode).toBe(409);
    expect(json(res).code).toBe('LH_MERGE_BLOCKED');
  }, 30000);

  it('POST /pull-requests/:id/reviews: approving moves the PR to approved (golden path)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/pull-requests/${pullRequestId}/reviews`,
      payload: { reviewer: 'reviewer-1', decision: 'approve' },
    });
    expect(res.statusCode).toBe(201);
    expect(json(res).status).toBe('approved');
  });

  it('POST /pull-requests/:id/reviews: rejects an invalid decision value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/pull-requests/${pullRequestId}/reviews`,
      payload: { reviewer: 'reviewer-2', decision: 'strongly_approve' },
    });
    expect(res.statusCode).toBe(400);
    expect(json(res).code).toBe('LH_SCHEMA_INVALID');
  });

  it('POST /pull-requests/:id/merge: merges once eligible and produces a new revision (golden path)', async () => {
    const res = await app.inject({ method: 'POST', url: `/pull-requests/${pullRequestId}/merge`, payload: { mergedBy: 'tester' } });
    expect(res.statusCode).toBe(200);
    const body = json(res);
    expect(body.pullRequest.status).toBe('merged');
    expect(body.revision.status).toBe('merged');
  }, 30000);

  it('GET /pull-requests/:id: reflects the merged state', async () => {
    const res = await app.inject({ method: 'GET', url: `/pull-requests/${pullRequestId}` });
    expect(res.statusCode).toBe(200);
    expect(json(res).status).toBe('merged');
  });

  it('POST /pull-requests/:id/close: refuses to close an already-merged pull request', async () => {
    const res = await app.inject({ method: 'POST', url: `/pull-requests/${pullRequestId}/close` });
    expect(res.statusCode).toBe(409);
    expect(json(res).code).toBe('LH_STATE_TRANSITION_INVALID');
  });

  it('POST /pull-requests/:id/close: golden path closes an open pull request', async () => {
    const openRes = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/pull-requests`,
      payload: { title: 'throwaway', baseBranch: fixture.baseBranch, baseRevisionId, headBranch: fixture.headBranch, headRevisionId, author: 'tester' },
    });
    const throwawayId = json(openRes).id;
    const closeRes = await app.inject({ method: 'POST', url: `/pull-requests/${throwawayId}/close` });
    expect(closeRes.statusCode).toBe(200);
    expect(json(closeRes).status).toBe('closed');
  });

  it('GET /artifacts/:artifactId: fetches metadata, and raw content with ?content=1', async () => {
    const validations = json(await app.inject({ method: 'GET', url: `/revisions/${headRevisionId}/validations` }));
    const withArtifact = validations.items.find((v: { artifactIds: string[] }) => v.artifactIds.length > 0);
    if (!withArtifact) return; // no kicad-cli in this sandbox -> no render/report artifacts were produced; nothing to fetch
    const artifactId = withArtifact.artifactIds[0];
    const metaRes = await app.inject({ method: 'GET', url: `/artifacts/${artifactId}` });
    expect(metaRes.statusCode).toBe(200);
    const contentRes = await app.inject({ method: 'GET', url: `/artifacts/${artifactId}?content=1` });
    expect(contentRes.statusCode).toBe(200);
  });

  it('GET /artifacts/:artifactId: 404s on an unknown artifact', async () => {
    const res = await app.inject({ method: 'GET', url: '/artifacts/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(json(res).code).toBe('LH_ARTIFACT_NOT_FOUND');
  });

  it('POST /modules + GET /modules/:id: golden path', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/modules',
      payload: { namespace: 'logichub', name: 'buck-regulator-module', version: '1.0.0', maintainers: ['tester'] },
    });
    expect(createRes.statusCode).toBe(201);
    const moduleId = json(createRes).id;

    const getRes = await app.inject({ method: 'GET', url: `/modules/${moduleId}` });
    expect(getRes.statusCode).toBe(200);
    expect(json(getRes).verificationStatus).toBe('unverified');
  });

  it('POST /modules: rejects a missing required field', async () => {
    const res = await app.inject({ method: 'POST', url: '/modules', payload: { namespace: 'logichub' } });
    expect(res.statusCode).toBe(400);
    expect(json(res).code).toBe('LH_SCHEMA_INVALID');
  });

  it('GET /modules: pagination is exercised on a multi-page result set', async () => {
    for (let i = 0; i < 25; i++) {
      await app.inject({
        method: 'POST',
        url: '/modules',
        payload: { namespace: 'logichub', name: `pagination-fixture-${i}`, version: '1.0.0', maintainers: [] },
      });
    }
    const firstPage = json(await app.inject({ method: 'GET', url: '/modules?limit=10&offset=0' }));
    expect(firstPage.items).toHaveLength(10);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.total).toBeGreaterThanOrEqual(26);

    const secondPage = json(await app.inject({ method: 'GET', url: '/modules?limit=10&offset=10' }));
    expect(secondPage.items).toHaveLength(10);
    const firstIds = new Set(firstPage.items.map((m: { id: string }) => m.id));
    for (const item of secondPage.items) {
      expect(firstIds.has(item.id)).toBe(false);
    }

    const lastPage = json(await app.inject({ method: 'GET', url: `/modules?limit=10&offset=${firstPage.total - 1}` }));
    expect(lastPage.items).toHaveLength(1);
    expect(lastPage.hasMore).toBe(false);
  });
});
