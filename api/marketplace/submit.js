// LogicHub/api/marketplace/submit.js
// Accept telemetry for a pull request, persist it, and return the digest it
// actually hashes to. Does not evaluate — no ruleset is loaded and no rule
// is run here. `run-ci.js` is the only place that happens.
//
// Accepts either shape:
//   { pullRequestId, submission: { payload, declaredDigest } } -- an
//     already-sealed submission, as a real inspection device would send:
//     the digest was computed at the point of measurement, so the server
//     can detect anything altered in transit.
//   { pullRequestId, payload } -- a raw, unsealed payload, for the
//     workspace UI's manual-entry form. There is no separate device to seal
//     it before the browser, so the server seals it here via `sealPayload`
//     -- consistent with "the pipeline must not run in the browser": hashing
//     happens server-side either way, never in client JS.
//
// Either way, `verifySubmission` (structural digest check, not rule
// evaluation) runs before anything is persisted, so a malformed or
// mismatched submission is rejected immediately rather than only discovered
// wrong when CI later runs — the same Stage 1 check `runPipeline` itself
// does, kept consistent rather than silently trusting it until later.
import { applyCors } from '../_payments-config.js';
import { getAdminDb } from '../_pg.js';
import {
  verifySubmission,
  sealPayload,
  beginInspection,
} from '../../engineering/packages/physical-ci/dist/index.js';
import { PULL_REQUESTS_COLLECTION } from './claim.js';

export const SUBMISSIONS_COLLECTION = 'marketplace_submissions';

/** States a fresh submission may be accepted into. */
const ACCEPTS_SUBMISSION = new Set(['DRAFT', 'IN_INSPECTION']);

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const pullRequestId = String(req.body?.pullRequestId || '').trim();
  const rawPayload = req.body?.payload;
  let submission = req.body?.submission;

  if (!pullRequestId || (!submission && !rawPayload)) {
    return res.status(400).json({ error: 'pullRequestId_and_submission_or_payload_required' });
  }

  if (!submission && rawPayload) {
    try {
      submission = sealPayload(rawPayload);
    } catch (error) {
      return res.status(422).json({
        error: 'ERR_PAYLOAD_MALFORMED',
        message: `Payload could not be sealed: ${error.message}`,
      });
    }
  }

  if (!submission || typeof submission !== 'object') {
    return res.status(400).json({ error: 'pullRequestId_and_submission_or_payload_required' });
  }

  const db = getAdminDb();
  const prRef = db.collection(PULL_REQUESTS_COLLECTION).doc(pullRequestId);

  let pullRequest;
  try {
    const snapshot = await prRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'pull_request_not_found' });
    pullRequest = snapshot.data();
  } catch (error) {
    console.error('Failed to read pull request for submission:', error);
    return res.status(503).json({ error: 'submit_unavailable' });
  }

  if (!ACCEPTS_SUBMISSION.has(pullRequest.state)) {
    return res.status(409).json({
      error: 'pull_request_not_accepting_submissions',
      message: `Pull request is ${pullRequest.state}. A submission can only be accepted `
        + `while it is DRAFT or IN_INSPECTION.`,
    });
  }

  const verified = verifySubmission(submission);
  if (!verified.ok) {
    return res.status(422).json({
      error: verified.code,
      message: verified.detail,
      computedDigest: verified.computedDigest,
    });
  }

  const now = new Date().toISOString();
  const nextPr = pullRequest.state === 'DRAFT' ? beginInspection(pullRequest, now) : pullRequest;

  try {
    await db.collection(SUBMISSIONS_COLLECTION).doc(pullRequestId).set({
      pullRequestId,
      submission,
      digest: verified.digest,
      receivedAt: now,
    });
    if (nextPr !== pullRequest) {
      await prRef.set(nextPr, { merge: true });
    }
  } catch (error) {
    console.error('Failed to persist submission:', error);
    return res.status(503).json({ error: 'submission_not_recorded' });
  }

  return res.status(200).json({ digest: verified.digest, pullRequestState: nextPr.state });
}
