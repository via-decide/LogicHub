# Deterministic Verification Test Suite — Status Report

## Purpose

Follow-up to the original test-suite request (Role: Principal QA Engineer — binary
determinism, immutable commit hashes, automated CI/CD gates). That request asked for a
comprehensive suite covering telemetry hashing, the YAML rule evaluator, adversarial/edge
cases, and merge-gate assertions. This report replaces the original request with what's
actually true now: every scenario it asked for is real, has run, and is green — plus the
marketplace layer built on top of `physical-ci` since then, and a list of real bugs this
testing work found and fixed, not just a coverage count.

**Numbers, all run in this environment, not estimated**: 92 vitest tests in
`engineering/packages/physical-ci`, 49 root `node --test` tests, 8 Playwright e2e tests
(including one real, full-flow, browser-driven run: claim → submit failing telemetry → gate
refuses → retry → submit corrected telemetry → passes → release confirms no funds moved).

---

## 1. Telemetry Payload & Hashing Verification

**Status: real, already existed, confirmed.** `src/telemetry/digest.ts` + `__tests__/digest.test.ts`
(14 tests):
- `telemetryDigest()` reuses `hashValue` from `project-capsule` — canonical JSON, sorted keys at
  every depth, `-0` normalized, non-finite refused.
- `it('changes when a single coordinate moves in the fourth decimal place')` — the exact
  25.0000→25.0001 scenario the original request asked for, real and passing.
- `verifySubmission()` rejects a payload whose declared digest doesn't match what it actually
  hashes to (`ERR_DIGEST_MISMATCH`), and rejects malformed payloads before hashing anything at
  all (`ERR_PAYLOAD_MALFORMED`).

## 2. CI/CD Rule Evaluator

**Status: real, already existed, confirmed.** `src/rules/inspection-rules.ts` +
`__tests__/inspection-rules.test.ts` (24 tests):
- `it('fails 25.0500001 with ERR_TOLERANCE_BREACH')` — the exact boundary case the original
  request named, real and passing. Bound arithmetic is deliberately asymmetric: the *bound* is
  rounded to recover `25.00 + 0.05 = 25.05` (not the double `25.049999999999997`), but the
  *reading* is never rounded — a hair outside stays outside.
- A property the ruleset requires and nothing measured is a failure (`ERR_PROPERTY_ABSENT`), not
  a skip — covers the "3 of 4 required nodes" partial-submission case at the rule-evaluation
  level (the node-completeness level is covered separately below).
- `NaN`/`Infinity` refused outright, not compared (a `NaN > bound` comparison is `false` in both
  directions, which would silently read as a pass).

## 3. Adversarial & Edge Cases

**Status: mostly already existed; one real gap found and closed.**

`src/pipeline/integrity.ts` already implemented every scenario the original request asked for —
replayed frames, out-of-order sequences, partial telemetry, duplicate nodes — but had **no
dedicated unit test file**, only indirect coverage through `merge-gate.ts`'s pipeline-level
tests. Added `__tests__/integrity.test.ts` (12 new tests) testing `checkCompleteness`,
`checkDistinctNodes`, `checkFrameOrdering`, and `checkIntegrity`'s aggregation directly:
- Spoofed telemetry: replayed sequence numbers (`ERR_REPLAYED_FRAME`), non-monotonic sequence/
  timestamp (`ERR_SEQUENCE_NOT_MONOTONIC` / `ERR_TIMESTAMP_NOT_MONOTONIC`) — equal timestamps
  allowed (real nodes emit multiple frames per millisecond), earlier ones are not.
- Partial submissions: 3 of 4 required nodes → `FAILED_INCOMPLETE_TELEMETRY`, the pipeline halts
  rather than scoring what arrived.
- State-machine deadlock prevention: `canRetrigger()` refuses to re-evaluate a digest a pull
  request already judged (`ERR_DIGEST_ALREADY_EVALUATED`) — a vendor can't loop CI on a rejected
  commit hoping for a different answer, since the evaluation is deterministic and would give the
  same one.
- New: multiple simultaneous violations reported together (missing node + duplicate node +
  replayed frame in one payload), not just the first one found — and violation ordering is
  stable regardless of stream order in the payload.

## 4. Merge Gate Assertion Engine

**Status: real, already existed, confirmed.** `src/pipeline/merge-gate.ts` +
`__tests__/merge-gate.test.ts` (24 tests):
- State transitions `DRAFT → IN_INSPECTION → EVALUATING → PASSED/FAILED → MERGED`, with no edge
  out of `FAILED` and `MERGED` treated as terminal.
- `releasePayment()` releases **only and strictly** when `state === 'PASSED'` **and**
  `ciStatus === 0` — both checked independently rather than one trusted to imply the other, and
  `it('takes no override argument')` pins the function's real signature (one argument, no bypass
  flag).

---

## What's new since the original request: the marketplace layer

`physical-ci` had no API surface or UI when the original request landed — nothing outside vitest
could exercise it. That's been built since (`src/marketplace/`, `api/marketplace/*.js`, the
`workspace.html` UI), with its own real test coverage:

- **`__tests__/marketplace-workflow.test.ts`** (18 tests) — pure state transitions
  (`canClaimIssue`, `createPullRequestFromClaim`, `beginInspection`/`beginEvaluation`/
  `applyRunResult`/`mergePullRequest`), all routed through the same `PR_TRANSITIONS` map
  `merge-gate.ts` already uses, not a second state machine. Includes the specific
  `allConditionsMet` regression test the original UI mockup would have failed: a single `PENDING`
  condition blocks release even when everything else passed.
- **`tests/marketplace-handlers.test.mjs`** (7 tests, root-level `node --test`) — the five
  `api/marketplace/*.js` handlers against a fake in-memory db (`api/_pg.js`'s new
  `__setAdminDbForTesting` seam), covering the three scenarios explicitly required: a submission
  failing its digest never reaches a rule; a re-run of an already-evaluated digest is refused;
  `release.js` reports no funds moved while payments are off — while still recording the real
  decision.
- **`tests/e2e/workspace.spec.ts`** (8 Playwright tests) — real browser, real handlers (not
  mocked), a fake db, run against `scripts/dev-marketplace-server.mjs`. One test drives the
  entire lifecycle end to end; others cover the PENDING-blocks-release UI behavior, the standing
  no-payment notice, keyboard tab navigation, label association, and zero-blocking-violation axe
  scans across all three tabs.

## Real bugs this testing work found and fixed

Listed because a coverage number alone doesn't say whether the tests are doing anything — these
are concrete defects that existed until a real test caught them:

1. **A regression in the storage-layer migration** — rewriting `_waitlist.js`'s rate limiter to
   an atomic SQL upsert broke the *existing* `tests/waitlist.test.mjs` (still using the old
   Firestore-shaped fake). Caught by running the full existing suite, not just new tests; fixed.
2. **`run-ci.js`'s retrigger check was unreachable in practice** — ordered after a state check
   that always fired first, so a repeat call never actually produced
   `ERR_DIGEST_ALREADY_EVALUATED`. Reordered.
3. **A stranding bug in the marketplace workflow**: `FAILED` is correctly terminal for a pull
   request, but nothing reopened the *issue* — one failed submission would permanently strand it
   at `CLAIMED` with no path to retry. New `reopenIssueAfterFailure`, tested, wired into
   `run-ci.js`.
4. **Two client-side icon calls were missing their build-time interpolation** — calling a
   Node-only function from the browser, throwing a silent `ReferenceError` that a `.catch()`
   swallowed into a misleading "issues unavailable" state. Found only by driving a real browser
   against the real handlers, not by unit-testing either side in isolation.
5. **`run-ci.js` never included the per-rule findings in its API response at all** — the verdict
   table had nothing real to render. Also only surfaced by the real e2e run.
6. **Genuine, axe-confirmed color-contrast violations** in the workspace UI's muted text color —
   fixed and re-verified at zero blocking violations across all three tabs.
7. Two bugs in the test infrastructure itself (an async-unsafe `withEnv` helper that restored env
   vars before the handler it was testing finished running; missing cross-test state isolation in
   the fake db) — worth listing because a wrong test can hide a real bug as easily as a missing
   one can.

## What isn't verified here

A live Postgres connection and a real Vercel deploy remain unverified in this environment — same
`minimumReleaseAge` lockfile policy blocker noted elsewhere in this branch, not something specific
to the test suite. Everything above was run against real code paths with a fake in-memory store
standing in only for the database connection itself, not for any business logic.
