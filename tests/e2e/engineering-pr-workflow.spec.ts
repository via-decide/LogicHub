// Phase 8 end-to-end coverage for the LogicHub engineering platform
// (engineering/docs/architecture/00-master-task-spec.md section 15).
//
// The full import -> diff -> validate pipeline already has automated
// integration coverage that does not need a browser:
//   - engineering/packages/domain/__tests__/fixture-import-and-diff.test.ts
//   - engineering/packages/domain/__tests__/merge-service.test.ts
//   - engineering/apps/api/__tests__/api.test.ts
// This spec covers what those cannot: "a browser-based Playwright test must
// exercise the primary user path" -- an engineer opening a real pull
// request, reading the evidence across its tabs, approving it, recalculating
// eligibility, and merging it, all through the actual rendered UI, then
// following through to the newly created merged revision to confirm real
// snapshot hashes were recorded (not fabricated).
//
// Setup (creating the project and importing both revisions) is done via
// direct API calls rather than a UI form, because apps/web has no import
// form (master spec section 13 does not require one) -- that half of the
// workflow is what the integration tests above already prove.

import { test, expect, type APIRequestContext } from '@playwright/test';
import { mkdtemp, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(HERE, '..', '..', 'engineering', 'fixtures', 'kicad', 'smart-plant-pot');
const API_URL = process.env.ENGINEERING_API_URL || 'http://127.0.0.1:3010';

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

async function createFixtureRepo(): Promise<{ repoPath: string; baseSha: string; headSha: string }> {
  const repoPath = await mkdtemp(join(tmpdir(), 'logichub-e2e-fixture-'));
  await git(['init', '-b', 'main'], repoPath);
  await git(['config', 'user.email', 'e2e@logichub.test'], repoPath);
  await git(['config', 'user.name', 'LogicHub E2E'], repoPath);
  await git(['config', 'commit.gpgsign', 'false'], repoPath);

  await cp(join(FIXTURE_ROOT, 'base'), repoPath, { recursive: true });
  await git(['add', '-A'], repoPath);
  await git(['commit', '-m', 'base: smart-plant-pot baseline'], repoPath);
  const baseSha = await git(['rev-parse', 'HEAD'], repoPath);

  await git(['checkout', '-b', 'feature/proposed'], repoPath);
  await cp(join(FIXTURE_ROOT, 'proposed'), repoPath, { recursive: true });
  await git(['add', '-A'], repoPath);
  await git(['commit', '-m', 'proposed: input protection, regulator swap, LED removal'], repoPath);
  const headSha = await git(['rev-parse', 'HEAD'], repoPath);

  await git(['checkout', 'main'], repoPath);
  return { repoPath, baseSha, headSha };
}

async function seedPullRequest(request: APIRequestContext) {
  const fixture = await createFixtureRepo();

  const projectRes = await request.post(`${API_URL}/projects`, {
    data: {
      slug: `e2e-smart-plant-pot-${Date.now()}`,
      name: 'E2E Smart Plant Pot',
      visibility: 'private',
      repository: { provider: 'git', localPath: fixture.repoPath, defaultBranch: 'main' },
      defaultBranch: 'main',
      createdBy: 'e2e',
    },
  });
  expect(projectRes.ok()).toBeTruthy();
  const project = await projectRes.json();

  const baseRes = await request.post(`${API_URL}/projects/${project.id}/revisions/import`, {
    data: { ref: fixture.baseSha, branchName: 'main', author: 'e2e', message: 'base import' },
  });
  expect(baseRes.ok()).toBeTruthy();
  const baseRevision = await baseRes.json();

  const headRes = await request.post(`${API_URL}/projects/${project.id}/revisions/import`, {
    data: { ref: fixture.headSha, branchName: 'feature/proposed', author: 'e2e', message: 'proposed import' },
  });
  expect(headRes.ok()).toBeTruthy();
  const headRevision = await headRes.json();

  const prRes = await request.post(`${API_URL}/projects/${project.id}/pull-requests`, {
    data: {
      title: 'Input protection + regulator swap',
      baseBranch: 'main',
      baseRevisionId: baseRevision.id,
      headBranch: 'feature/proposed',
      headRevisionId: headRevision.id,
      author: 'e2e',
      requiredApprovals: 1,
    },
  });
  expect(prRes.ok()).toBeTruthy();
  const pullRequest = await prRes.json();

  return { repoPath: fixture.repoPath, project, baseRevision, headRevision, pullRequest };
}

test.describe('engineering pull request review path', () => {
  test('an engineer opens a real PR, reviews the evidence, approves, and merges it through the browser', async ({
    page,
    request,
  }) => {
    const seed = await seedPullRequest(request);

    try {
      await page.goto(`/pull-requests/${seed.pullRequest.id}`);
      await expect(page.getByRole('heading', { name: 'Input protection + regulator swap' })).toBeVisible();

      // Overview: real diff-derived data, not a mockup.
      await expect(page.getByText('Change summary')).toBeVisible();
      await expect(page.getByText('schematic', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Merge gates (16 conditions)')).toBeVisible();
      // Blocked before any review -- required approvals not yet met.
      await expect(page.getByText('Blocked')).toBeVisible({ timeout: 15_000 });

      // Constraints tab: real constraint evaluation, not empty.
      await page.getByRole('button', { name: 'Constraints' }).click();
      await expect(page.getByText('Constraint evaluation')).toBeVisible();

      // Files/Schematic/PCB/BOM tabs surface the real structural diff.
      await page.getByRole('button', { name: 'Schematic', exact: true }).click();
      await expect(page.getByText(/change\(s\)|1 change/)).toBeVisible();

      // Reviews tab starts empty.
      await page.getByRole('button', { name: 'Reviews' }).click();
      await expect(page.getByText('No reviews submitted yet.')).toBeVisible();

      // Approve as a reviewer.
      await page.getByPlaceholder('Your name (reviewer)').fill('e2e-reviewer');
      await page.getByRole('button', { name: 'Approve' }).click();
      await expect(page.getByRole('button', { name: 'Approve' })).toBeEnabled({ timeout: 15_000 });

      await page.getByRole('button', { name: 'Reviews' }).click();
      await expect(page.getByText('e2e-reviewer')).toBeVisible();
      await expect(page.getByText('Approved').first()).toBeVisible();

      // Eligibility flips once the required approval is satisfied.
      await page.getByRole('button', { name: 'Overview' }).click();
      await expect(page.getByText('Eligible to merge')).toBeVisible({ timeout: 15_000 });

      // Merge.
      await page.getByPlaceholder('Your name (merging as)').fill('e2e-maintainer');
      await page.getByRole('button', { name: 'Merge' }).click();
      await expect(page.getByText('Merged').first()).toBeVisible({ timeout: 20_000 });

      // Follow through to the newly created merged revision and confirm real
      // (non-empty) snapshot hashes were recorded -- not fabricated.
      await page.getByRole('link', { name: /^[0-9a-f]{10}$/ }).first().click();
      await expect(page.getByText('Snapshot hashes')).toBeVisible();
      const objectsHash = page.getByText('Objects').locator('xpath=following-sibling::dd[1]');
      await expect(objectsHash).not.toHaveText('unset');
      await expect(objectsHash).toHaveText(/^[0-9a-f]{16,}/);
    } finally {
      await rm(seed.repoPath, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});
