// LogicHub/tests/marketplace-handlers.test.mjs
// Regression tests for the api/marketplace/* handlers, against a fake
// in-memory store rather than a live Postgres connection — following the
// same pattern tests/orders.test.mjs and tests/waitlist.test.mjs already
// use for _orders.js/_waitlist.js's functions that take `db` as a
// parameter. These handlers call `getAdminDb()` internally instead (a real
// Vercel function's signature is `(req, res)`, not a place to thread a
// database through), so `api/_pg.js`'s `__setAdminDbForTesting` is the seam
// that substitutes the fake here — never called from production code.
//
// Run: node --test "tests/*.test.mjs"

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { __setAdminDbForTesting } from '../api/_pg.js';
import issuesHandler, { ISSUES_COLLECTION } from '../api/marketplace/issues.js';
import claimHandler, { CLAIMS_COLLECTION, PULL_REQUESTS_COLLECTION } from '../api/marketplace/claim.js';
import submitHandler, { SUBMISSIONS_COLLECTION } from '../api/marketplace/submit.js';
import runCiHandler, { CI_RUNS_COLLECTION } from '../api/marketplace/run-ci.js';
import releaseHandler, { RELEASE_DECISIONS_COLLECTION } from '../api/marketplace/release.js';

/**
 * The same generic Firestore-shaped fake `api/_pg.js`'s real
 * `PostgresFirestoreCompat` implements (collection/doc/get/set/list), held
 * in a plain Map per collection instead of Postgres. Shaped to match
 * exactly what the handlers call — no query capability beyond what
 * `issues.js`'s single equality filter needs.
 */
function fakeDb() {
  const collections = new Map();
  function docsFor(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }
  return {
    collection(name) {
      const docs = docsFor(name);
      return {
        doc(id) {
          return {
            async get() {
              const data = docs.get(id);
              return { exists: data !== undefined, data: () => (data ? { ...data } : undefined) };
            },
            async set(data, options = {}) {
              const base = options.merge ? docs.get(id) || {} : {};
              docs.set(id, { ...base, ...data });
            },
          };
        },
        async list({ where } = {}) {
          let entries = [...docs.entries()];
          if (where) entries = entries.filter(([, d]) => String(d[where.field]) === String(where.value));
          // Real store orders by updated_at DESC; insertion order is a fine
          // stand-in here since these tests never depend on exact ordering
          // beyond "the one just written comes back."
          return entries.reverse().map(([id, data]) => ({ id, data: () => ({ ...data }) }));
        },
      };
    },
    _raw(name) {
      return docsFor(name);
    },
  };
}

function mockReq(method, body) {
  return { method, headers: {}, body: body || {} };
}

function mockRes() {
  const res = {
    headers: {},
    setHeader(key, value) { res.headers[key] = value; },
    status(code) { res.code = code; return res; },
    json(body) { res.body = body; return res; },
    send(body) { res.body = body; return res; },
    end() { return res; },
  };
  return res;
}

// Async-safe, unlike tests/payments-guard.test.mjs's and
// tests/waitlist.test.mjs's own copies of this helper: those are only ever
// called with a synchronous `run`, so the missing `await` before `finally`
// never mattered there. This file's handler calls are async, and a `finally`
// that fires before `run()`'s returned promise settles restores the env
// vars WHILE the handler is still mid-flight — found live, the first draft
// of this file's release.js payments-on test saw `paymentsEnabled()` read
// `false` because PAYMENTS_ENABLED had already been deleted again by the
// time the handler actually checked it.
async function withEnv(values, run) {
  const saved = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const RULESET_YAML = `rules:
  - property: diameter_mm
    target: 25.00
    tolerance: 0.05
`;

function seedOpenIssue(db, overrides = {}) {
  const issue = {
    id: 'ISSUE-1',
    schemaVersion: '0.1.0',
    repositoryId: 'via-decide/LogicHub',
    title: 'Manufacture a cartridge shell',
    description: 'Per spec.',
    rulesetYaml: RULESET_YAML,
    requiredNodeIds: ['micrometer-01'],
    bounty: { state: 'UNAVAILABLE', reason: 'No component sourced.' },
    status: 'OPEN',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'creator-1',
    ...overrides,
  };
  db._raw(ISSUES_COLLECTION).set(issue.id, issue);
  return issue;
}

function passingPayload(overrides = {}) {
  return {
    submissionId: 'sub-1',
    vendorId: 'vendor-1',
    partNumber: 'CARTRIDGE-SHELL-UPPER',
    serialNumber: 'FIXTURE-0001',
    capturedAt: '2026-01-01T00:00:00.000Z',
    streams: [{
      nodeId: 'micrometer-01', nodeKind: 'micrometer', nodeRevision: 'fw', unit: 'mm',
      frames: [{ sequence: 0, timestampMs: 0, values: { diameter_mm: 25.0 } }],
    }],
    ...overrides,
  };
}

let db;
beforeEach(() => {
  db = fakeDb();
  __setAdminDbForTesting(db);
});

// --- issues -------------------------------------------------------------

test('issues.js lists only OPEN issues', async () => {
  seedOpenIssue(db, { id: 'ISSUE-OPEN' });
  seedOpenIssue(db, { id: 'ISSUE-CLAIMED', status: 'CLAIMED' });

  const res = mockRes();
  await issuesHandler(mockReq('GET'), res);

  assert.equal(res.code, 200);
  assert.equal(res.body.issues.length, 1);
  assert.equal(res.body.issues[0].id, 'ISSUE-OPEN');
});

// --- claim ----------------------------------------------------------------

test('claiming an open issue creates a DRAFT pull request and marks the issue CLAIMED', async () => {
  seedOpenIssue(db);

  const res = mockRes();
  await claimHandler(mockReq('POST', { issueId: 'ISSUE-1', vendorId: 'vendor-1' }), res);

  assert.equal(res.code, 200);
  assert.equal(res.body.pullRequest.state, 'DRAFT');
  assert.equal(res.body.pullRequest.vendorId, 'vendor-1');
  assert.equal(db._raw(ISSUES_COLLECTION).get('ISSUE-1').status, 'CLAIMED');
  assert.equal(db._raw(CLAIMS_COLLECTION).size, 1);
});

test('claiming an already-claimed issue is refused', async () => {
  seedOpenIssue(db, { status: 'CLAIMED' });

  const res = mockRes();
  await claimHandler(mockReq('POST', { issueId: 'ISSUE-1', vendorId: 'vendor-1' }), res);

  assert.equal(res.code, 409);
  assert.equal(res.body.error, 'issue_not_claimable');
  // No pull request or claim should have been created for a refused claim.
  assert.equal(db._raw(PULL_REQUESTS_COLLECTION).size, 0);
});

// --- the plan's three explicitly required scenarios ----------------------

test('a submission failing its digest never reaches a rule', async () => {
  seedOpenIssue(db);
  const claimRes = mockRes();
  await claimHandler(mockReq('POST', { issueId: 'ISSUE-1', vendorId: 'vendor-1' }), claimRes);
  const prId = claimRes.body.pullRequest.id;

  // A submission whose declared digest does not match its payload -- the
  // exact tamper case digest.ts exists to catch.
  const tampered = {
    payload: passingPayload(),
    declaredDigest: 'f'.repeat(64),
  };

  const submitRes = mockRes();
  await submitHandler(mockReq('POST', { pullRequestId: prId, submission: tampered }), submitRes);

  assert.equal(submitRes.code, 422);
  assert.equal(submitRes.body.error, 'ERR_DIGEST_MISMATCH');
  // Nothing was persisted, and the pull request never left DRAFT -- a rule
  // was never given the chance to run against unverified bytes.
  assert.equal(db._raw(SUBMISSIONS_COLLECTION).size, 0);
  assert.equal(db._raw(PULL_REQUESTS_COLLECTION).get(prId).state, 'DRAFT');
});

test('a re-run of an already-evaluated digest is refused, not silently re-scored', async () => {
  seedOpenIssue(db);
  const claimRes = mockRes();
  await claimHandler(mockReq('POST', { issueId: 'ISSUE-1', vendorId: 'vendor-1' }), claimRes);
  const prId = claimRes.body.pullRequest.id;

  await submitHandler(mockReq('POST', { pullRequestId: prId, payload: passingPayload() }), mockRes());
  const firstRun = mockRes();
  await runCiHandler(mockReq('POST', { pullRequestId: prId }), firstRun);
  assert.equal(firstRun.code, 200);
  assert.equal(firstRun.body.run.state, 'PASSED');

  // Re-submitting the identical payload seals to the identical digest --
  // resubmit.js accepts it (a submission itself isn't refused), but run-ci
  // must refuse to re-evaluate it.
  await submitHandler(mockReq('POST', { pullRequestId: prId, payload: passingPayload() }), mockRes());
  const secondRun = mockRes();
  await runCiHandler(mockReq('POST', { pullRequestId: prId }), secondRun);

  assert.equal(secondRun.code, 409);
  assert.equal(secondRun.body.error, 'ERR_DIGEST_ALREADY_EVALUATED');
  // Only the first run was ever recorded.
  assert.equal(db._raw(CI_RUNS_COLLECTION).size, 1);
});

test('release.js reports no funds moved while payments are off, but still records the decision', async () => {
  await withEnv({ PAYMENTS_ENABLED: undefined }, async () => {
    seedOpenIssue(db);
    const claimRes = mockRes();
    await claimHandler(mockReq('POST', { issueId: 'ISSUE-1', vendorId: 'vendor-1' }), claimRes);
    const prId = claimRes.body.pullRequest.id;

    await submitHandler(mockReq('POST', { pullRequestId: prId, payload: passingPayload() }), mockRes());
    await runCiHandler(mockReq('POST', { pullRequestId: prId }), mockRes());

    const releaseRes = mockRes();
    await releaseHandler(mockReq('POST', { pullRequestId: prId }), releaseRes);

    assert.equal(releaseRes.code, 503);
    assert.equal(releaseRes.body.error, 'payments_disabled');
    assert.match(releaseRes.body.message, /No charge has been made/);

    // The decision is still real and recorded -- released:true was actually
    // computed (the run passed with ciStatus 0), just never acted on.
    const decision = db._raw(RELEASE_DECISIONS_COLLECTION).get(prId);
    assert.equal(decision.released, true);
    assert.equal(decision.paymentsEnabled, false);

    // The pull request still merges -- physical acceptance is independent
    // of the payment rail, per workflow.ts's mergePullRequest.
    assert.equal(db._raw(PULL_REQUESTS_COLLECTION).get(prId).state, 'MERGED');
  });
});

test('a hair-outside submission fails CI and blocks release entirely', async () => {
  seedOpenIssue(db);
  const claimRes = mockRes();
  await claimHandler(mockReq('POST', { issueId: 'ISSUE-1', vendorId: 'vendor-1' }), claimRes);
  const prId = claimRes.body.pullRequest.id;

  await submitHandler(
    mockReq('POST', { pullRequestId: prId, payload: passingPayload({ streams: [{
      nodeId: 'micrometer-01', nodeKind: 'micrometer', nodeRevision: 'fw', unit: 'mm',
      frames: [{ sequence: 0, timestampMs: 0, values: { diameter_mm: 25.0500001 } }],
    }] }) }),
    mockRes(),
  );
  const runRes = mockRes();
  await runCiHandler(mockReq('POST', { pullRequestId: prId }), runRes);

  assert.equal(runRes.body.run.state, 'FAILED');
  assert.deepEqual(runRes.body.run.codes, ['ERR_TOLERANCE_BREACH']);

  // FAILED is terminal for this pull request, but the issue reopens so a
  // fresh claim (a real retry, with a genuinely new payload) is possible --
  // without this, one failed attempt would strand the issue forever.
  assert.equal(db._raw(ISSUES_COLLECTION).get('ISSUE-1').status, 'OPEN');
  const retryRes = mockRes();
  await claimHandler(mockReq('POST', { issueId: 'ISSUE-1', vendorId: 'vendor-1' }), retryRes);
  assert.equal(retryRes.code, 200);
  assert.notEqual(retryRes.body.pullRequest.id, prId);

  await withEnv({ PAYMENTS_ENABLED: 'true', RAZORPAY_KEY_ID: 'x', RAZORPAY_KEY_SECRET: 'y' }, async () => {
    const releaseRes = mockRes();
    await releaseHandler(mockReq('POST', { pullRequestId: prId }), releaseRes);
    assert.equal(releaseRes.body.decision.released, false);
    // A FAILED pull request never becomes MERGED, even with payments on.
    assert.equal(db._raw(PULL_REQUESTS_COLLECTION).get(prId).state, 'FAILED');
  });
});
