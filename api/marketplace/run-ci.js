// LogicHub/api/marketplace/run-ci.js
// The gate. Loads the issue's ruleset and the pull request's prior run
// digests, evaluates the stored submission against them, persists the run,
// and transitions the pull request to whatever the pipeline decided.
import { applyCors } from '../_payments-config.js';
import { getAdminDb } from '../_pg.js';
import crypto from 'node:crypto';
import {
  parseRuleset,
  runPipeline,
  canRetrigger,
  beginEvaluation,
  applyRunResult,
  reopenIssueAfterFailure,
} from '../../engineering/packages/physical-ci/dist/index.js';
import { ISSUES_COLLECTION } from './issues.js';
import { PULL_REQUESTS_COLLECTION } from './claim.js';
import { SUBMISSIONS_COLLECTION } from './submit.js';
import { captureTask } from '../../services/task-capture.js';

export const CI_RUNS_COLLECTION = 'marketplace_ci_runs';

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
  let issue;
  let storedSubmission;
  try {
    const prSnapshot = await db.collection(PULL_REQUESTS_COLLECTION).doc(pullRequestId).get();
    if (!prSnapshot.exists) return res.status(404).json({ error: 'pull_request_not_found' });
    pullRequest = prSnapshot.data();

    const submissionSnapshot = await db.collection(SUBMISSIONS_COLLECTION).doc(pullRequestId).get();
    if (!submissionSnapshot.exists) {
      return res.status(409).json({
        error: 'no_submission',
        message: 'No telemetry has been submitted for this pull request yet.',
      });
    }
    storedSubmission = submissionSnapshot.data();

    const issueSnapshot = await db.collection(ISSUES_COLLECTION).doc(pullRequest.issueId).get();
    if (!issueSnapshot.exists) return res.status(500).json({ error: 'issue_missing_for_pull_request' });
    issue = issueSnapshot.data();
  } catch (error) {
    console.error('Failed to load state for CI run:', error);
    return res.status(503).json({ error: 'run_ci_unavailable' });
  }

  // Checked before the state gate below, not after: a pull request that
  // already reached PASSED/FAILED for this exact digest should be told
  // specifically "you already evaluated this content" (ERR_DIGEST_ALREADY_
  // EVALUATED), not the generic "not ready" a state check alone would give
  // it — since applyRunResult always records the run's digest into
  // evaluatedDigests, a repeat call for the same stored submission hits
  // this every time, and it's the more informative answer. Found live:
  // ordering the state check first made this branch unreachable in
  // practice, since a PR always leaves IN_INSPECTION within the same
  // run-ci.js call that first judged a digest.
  const retrigger = canRetrigger(storedSubmission.digest, pullRequest.evaluatedDigests);
  if (!retrigger.allowed) {
    return res.status(409).json({ error: 'ERR_DIGEST_ALREADY_EVALUATED', message: retrigger.reason });
  }

  if (pullRequest.state !== 'IN_INSPECTION') {
    return res.status(409).json({
      error: 'pull_request_not_ready',
      message: `Pull request is ${pullRequest.state}. CI can only run once a submission has `
        + 'moved it to IN_INSPECTION.',
    });
  }

  let ruleset;
  try {
    ruleset = parseRuleset(issue.rulesetYaml);
  } catch (error) {
    console.error(`Issue ${issue.id} has an unparseable ruleset:`, error.message);
    return res.status(500).json({ error: 'ruleset_malformed' });
  }

  const now = new Date().toISOString();
  const evaluating = beginEvaluation(pullRequest, now);

  const run = runPipeline({
    submission: storedSubmission.submission,
    ruleset,
    requiredNodeIds: issue.requiredNodeIds,
    evaluatedDigests: evaluating.evaluatedDigests,
  });

  const updatedPr = applyRunResult(evaluating, run, now);
  // `run.digest` is only ever '' when the submission itself was too
  // malformed to hash at all (Stage 1's parse failure) -- a random suffix
  // keeps the id unique in that case rather than colliding on a shared
  // empty-string key across every malformed run this PR ever attempts.
  const ciRun = {
    id: `run_${run.digest || crypto.randomUUID()}_${now}`.slice(0, 200),
    pullRequestId,
    digest: run.digest,
    state: run.state,
    ciStatus: run.ciStatus,
    codes: run.codes,
    detail: run.detail,
    // The per-property findings (property/passed/bounds/observed) --
    // dropped from earlier drafts of this response entirely, which meant
    // the workspace UI's verdict table had nothing to render but the
    // summary `detail` string. `run.rules` is `null` for a submission that
    // never reached rule evaluation at all (a digest mismatch or an
    // already-evaluated digest, both rejected before this stage runs).
    rules: run.rules,
    evaluatedAt: now,
  };

  try {
    await db.collection(PULL_REQUESTS_COLLECTION).doc(pullRequestId).set(updatedPr, { merge: true });
    await db.collection(CI_RUNS_COLLECTION).doc(ciRun.id).set(ciRun);
    // FAILED is terminal for THIS pull request (no transition out of it,
    // per PR_TRANSITIONS) -- but the issue itself must not be stranded at
    // CLAIMED forever with no PR that can ever pass. Reopening it is what
    // makes "fail once, fix it, try again" possible: the retry is a fresh
    // claim (a new pull request, a new digest), not a resurrection of this
    // one. See reopenIssueAfterFailure's docstring.
    if (updatedPr.state === 'FAILED') {
      await db.collection(ISSUES_COLLECTION).doc(issue.id).set(reopenIssueAfterFailure(issue), { merge: true });
    }
    
    // Capture this execution trace for Zayvora continuous learning loop
    captureTask({
      type: 'evaluate_telemetry',
      userId: pullRequest.vendorId || pullRequest.userId,
      projectContext: issue.title || 'hardware-project',
      request: { submission: storedSubmission.submission, ruleset: issue.rulesetYaml },
      ground_truth: { actual_verdict: ciRun.state }
    }).catch(console.error);
    
  } catch (error) {
    console.error('Failed to persist CI run:', error);
    return res.status(503).json({ error: 'run_not_recorded' });
  }

  return res.status(200).json({ run: ciRun, pullRequestState: updatedPr.state });
}
