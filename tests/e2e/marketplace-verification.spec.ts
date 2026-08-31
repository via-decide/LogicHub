// Server-backed regression for the existing deterministic marketplace gate.
// The native product workspace does not expose this legacy vocabulary, but
// this contract remains live until a revision-bound verification API replaces it.
import { test, expect, type APIRequestContext } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('/test/reset');
});

async function claim(request: APIRequestContext) {
  const response = await request.post('/api/marketplace/claim', {
    data: { issueId: 'ISSUE-E2E', vendorId: 'workspace-e2e' },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).pullRequest.id as string;
}

function telemetry(diameter: number, suffix: string) {
  return {
    submissionId: `sub-${suffix}`,
    vendorId: 'workspace-e2e',
    partNumber: 'VERIFICATION-FIXTURE',
    serialNumber: `FIXTURE-${suffix}`,
    capturedAt: '2026-08-20T00:00:00.000Z',
    streams: [{
      nodeId: 'manual-entry-01', nodeKind: 'micrometer', nodeRevision: 'e2e-1', unit: 'mm',
      frames: [{ sequence: 0, timestampMs: 0, values: { diameter_mm: diameter } }],
    }],
  };
}

async function submitAndRun(request: APIRequestContext, pullRequestId: string, diameter: number, suffix: string) {
  const submitted = await request.post('/api/marketplace/submit', {
    data: { pullRequestId, payload: telemetry(diameter, suffix) },
  });
  expect(submitted.ok()).toBeTruthy();
  const run = await request.post('/api/marketplace/run-ci', { data: { pullRequestId } });
  expect(run.ok()).toBeTruthy();
  return run.json();
}

test('real handlers reject bad telemetry, accept a corrected retry, and gate release', async ({ request }) => {
  const failedId = await claim(request);
  const failed = await submitAndRun(request, failedId, 30, 'bad');
  expect(failed.run.state).toBe('FAILED');
  expect(failed.pullRequestState).toBe('FAILED');

  // A failed evaluation reopens the fixture issue; correction gets a new,
  // immutable pull-request record rather than re-scoring the failed digest.
  const correctedId = await claim(request);
  const passed = await submitAndRun(request, correctedId, 25, 'corrected');
  expect(passed.run.state).toBe('PASSED');
  expect(passed.pullRequestState).toBe('PASSED');

  const release = await request.post('/api/marketplace/release', { data: { pullRequestId: correctedId } });
  expect(release.status()).toBe(503);
  const releaseBody = await release.json();
  expect(releaseBody.error).toBe('payments_disabled');
  expect(releaseBody.message).toContain('No charge has been made');
});
