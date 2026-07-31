// LogicHub/api/marketplace/release.js
// Whether funds may be released for a passed pull request.
//
// `commerce`'s ACTIVE_PHASE is 1 and PAYMENTS_ENABLED is unset in this build
// -- no money moves. `releasePayment`'s decision is still computed and
// recorded (so "would this have released, structurally" is a real, checkable
// fact independent of the toggle), but the response to the caller uses the
// same `paymentsDisabledResponse` wording every other payments endpoint
// uses while payments are off, so the UI has one honest message instead of
// two different ways of saying "no money moved."
//
// The pull request itself still moves PASSED -> MERGED here when it
// qualifies, regardless of the payments toggle -- see `workflow.ts`'s
// `mergePullRequest` docstring: a physical PR that passed CI is real
// independent of whether the settlement rail is switched on.
import { applyCors, paymentsEnabled, paymentsDisabledResponse } from '../_payments-config.js';
import { getAdminDb } from '../_pg.js';
import { releasePayment, mergePullRequest } from '../../engineering/packages/physical-ci/dist/index.js';
import { PULL_REQUESTS_COLLECTION } from './claim.js';
import { CI_RUNS_COLLECTION } from './run-ci.js';

export const RELEASE_DECISIONS_COLLECTION = 'marketplace_release_decisions';

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const pullRequestId = String(req.body?.pullRequestId || '').trim();
  if (!pullRequestId) return res.status(400).json({ error: 'pullRequestId_required' });

  const db = getAdminDb();

  let pullRequest;
  let latestRun;
  try {
    const prSnapshot = await db.collection(PULL_REQUESTS_COLLECTION).doc(pullRequestId).get();
    if (!prSnapshot.exists) return res.status(404).json({ error: 'pull_request_not_found' });
    pullRequest = prSnapshot.data();

    const runs = await db.collection(CI_RUNS_COLLECTION).list({
      where: { field: 'pullRequestId', value: pullRequestId },
    });
    if (runs.length === 0) {
      return res.status(409).json({ error: 'no_ci_run', message: 'This pull request has no CI run to release against.' });
    }
    // `.list()` orders by updated_at DESC, so the first row is the most
    // recent run -- the one that put the PR in its current state.
    latestRun = runs[0].data();
  } catch (error) {
    console.error('Failed to load state for release:', error);
    return res.status(503).json({ error: 'release_unavailable' });
  }

  // `releasePayment` takes a PipelineRun-shaped object; reconstructed from
  // the persisted CiRun rather than re-running the pipeline, since the run
  // already happened and this endpoint judges its recorded outcome, not a
  // fresh evaluation.
  const decision = releasePayment({
    digest: latestRun.digest,
    state: latestRun.state,
    ciStatus: latestRun.ciStatus,
    codes: latestRun.codes,
    rules: null,
    detail: latestRun.detail,
  });

  const now = new Date().toISOString();
  let updatedPr = pullRequest;
  if (pullRequest.state === 'PASSED') {
    updatedPr = mergePullRequest(pullRequest, now);
  }

  try {
    await db.collection(RELEASE_DECISIONS_COLLECTION).doc(pullRequestId).set({
      pullRequestId,
      runId: latestRun.id,
      released: decision.released,
      reason: decision.reason,
      paymentsEnabled: paymentsEnabled(),
      decidedAt: now,
    });
    if (updatedPr !== pullRequest) {
      await db.collection(PULL_REQUESTS_COLLECTION).doc(pullRequestId).set(updatedPr, { merge: true });
    }
  } catch (error) {
    console.error('Failed to persist release decision:', error);
    return res.status(503).json({ error: 'decision_not_recorded' });
  }

  if (!paymentsEnabled()) {
    return paymentsDisabledResponse(res);
  }

  return res.status(200).json({ decision, pullRequestState: updatedPr.state });
}
