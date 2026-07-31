# Antigravity IDE — end-to-end verification brief for LogicHub

Paste everything below the line into Antigravity. It is written to be run against
a clean checkout of the branch `claude/deploy-all` (PR #130).

---

You are verifying a repository end to end. Do not fix anything until you have
finished observing. Report what you find, then propose fixes separately.

## What this project is

LogicHub lets someone design hardware virtually — a graph of batteries,
controllers, drivers, motors and sensors — and see what that configuration could
become. The engine runs client-side. A deterministic rules layer decides what can
be claimed about a design.

The single organising principle you are testing against:

> **Missing data must never silently become zero. Unknown must never be treated
> as pass. A simulation is never reported as a measurement.**

Most of the work below is about verifying that principle holds under pressure.
A test that passes for the wrong reason is a finding.

## Repository shape

```
LogicHub/
├── engineering/            pnpm workspace, 15 TypeScript packages, vitest
│   └── packages/
│       ├── product-graph/      node plugins + two-pass propagation engine
│       ├── kit-matching/       component catalogue + kit matcher
│       ├── validation-engine/  deterministic rules (SEC-*)
│       ├── product-repository/ revisions, semantic diff, release gate
│       ├── project-capsule/    canonical JSON, capsule export, cartridge
│       ├── physical-loop/      measurement intake with provenance
│       └── commerce/           plans, entitlements, sovereignty boundary
├── apps/web/               Next.js 16 — the /product builder
├── api/                    Vercel serverless functions
├── scripts/                static site + policy page generators
└── tests/                  node:test unit tests, tests/e2e/ Playwright
```

## Step 1 — reproduce the stated results

Run each of these and record actual counts, not "passed":

```bash
pnpm install
cd engineering && pnpm install && pnpm build && pnpm test   # expect 1138 tests
cd .. && node --test "tests/*.test.mjs"                     # expect 42 tests
pnpm site:build && pnpm site:verify
node scripts/check-no-tracking.mjs
node scripts/check-placeholders.mjs
npx playwright test                                          # expect 46 specs
```

Report any count that differs from the expectation. A lower count is as much a
finding as a failure — it may mean tests are being skipped or not collected.

## Step 2 — the known blocker, confirm or refute

`api/_sovereignDb.js` imports `better-sqlite3`. Check whether that package is
declared in the **root** `package.json` and the root lockfile, or only inside
`engineering/`.

Then determine, for a Vercel deployment:

1. Would the import resolve at runtime for the functions under `api/`?
2. `better-sqlite3` writes a file next to the source. Does that survive on a
   read-only, ephemeral serverless filesystem?
3. Trace every endpoint that reaches it via `api/_sovereignAuth.js` and list them.
4. For each, state what a user would actually see. Note specifically that
   `api/waitlist.js` and `api/checkout.js` **fail closed** by design, so the
   symptom is a refusal, not silent data loss.

Do not fix this yet. Report the blast radius first, and say plainly whether the
site can be deployed with any write path working.

## Step 3 — attack the honesty guarantees

These are the claims the codebase makes about itself. Try to break each one. For
every attempt, say whether it held.

**Nothing is silently zero.**
- Build a graph where a driver node has no motor below it. Confirm
  `dissipationW` is *absent*, not `0`.
- Find every place a numeric could default. Grep for `?? 0`, `|| 0`,
  `Number(x) || 0`. Judge each: is that a real zero, or an unknown wearing one?

**Unknown is never pass.**
- Run `assessThermal` with no operating profile. It must be `UNKNOWN`.
- Give it a profile but no regulator thermal resistance. Still `UNKNOWN`.
- Confirm `decideRelease` blocks on `UNKNOWN`, `WARNING` **and**
  `REQUIRES_VALIDATION`. Try to find any path that releases past them.
- Confirm there is no override parameter on `decideRelease`. If you can add one
  without changing its signature, that is a finding.

**An estimate is never a measurement.**
- Set the regulator thermal resistance class to `estimated` with generous
  margin. The verdict must be `REQUIRES_VALIDATION`, never `PASS`.
- Search the whole repo for any place an `ESTIMATED` epistemic state could be
  upgraded without new evidence.

**No unearned claims.**
- Grep the built HTML and the `/product` page for: certified, child-safe,
  classroom-safe, production-ready, validated, tested, approved, guaranteed.
- For each hit, decide whether it is a claim or a denial of one. The Gate 9
  claim guard is negation-aware — verify it actually is, and try to fool it
  (a denial in one sentence followed by a claim in the next).

## Step 4 — determinism

- Run `pnpm test` three times. Any test that passes intermittently is a finding.
- Grep for `Math.random`, `Date.now`, `new Date()` inside `engineering/packages/*/src`.
  Each hit must be justified — the engine is meant to be free of both.
- Confirm canonical JSON sorts keys at every depth, treats `undefined` as
  absent, normalises `-0`, and refuses non-finite numbers.
- Take a product graph, serialise, deserialise, serialise again. Bytes must match.
- Float boundaries: there is a known fix where `3 × 1.2 ≠ 3.6` in binary floating
  point tripped an overvoltage check. Find the rounding convention and hunt for
  comparisons that do **not** follow it.

## Step 5 — the browser

Run the `/product` builder for real, not just through Playwright.

- Add each node type. Confirm none throws and none logs a console error.
- Confirm the graph is in `localStorage` and that **no network request carries
  graph content**. Watch the network tab across a full editing session. This is
  the central privacy claim of the product — verify it rather than trusting it.
- Reload mid-edit. Confirm the graph survives and nothing was posted.
- Corrupt the `localStorage` value deliberately. The page must recover, not
  white-screen.
- Check the two-pass propagation: a battery's runtime depends on loads that only
  publish after it. Construct a graph where a single pass would give the wrong
  answer, and confirm the answer is right.

## Step 6 — API behaviour under adversarial input

Run these locally. Do not point them at production.

**Payments (must be inert — `PAYMENTS_ENABLED` unset):**
- `POST /api/checkout` → expect `503`, and a message saying no charge was made.
- Set `PAYMENTS_ENABLED=1`, then `yes`, then `TRUE`. Only `TRUE`/`true` may
  enable. Confirm.
- Grep `api/` for `rzp_live_`. There must be no live key. A test exists for this;
  confirm the test would actually catch a reintroduction.
- With payments on but credentials absent, confirm it throws rather than
  substituting an empty secret.
- Unrecognised `package_id` must be `400`, never a default charge.

**Order integrity:**
- Verify a payment for an order id that was never created → must be `404`, and
  must write **nothing**. Confirm the write count is zero, not just the status.
- Verify the same payment twice → treated as a retry.
- Verify a *different* payment against a paid order → `409`, and the stored
  order must be unchanged.
- Confirm a failed signature increments a rejection counter and leaves `status`
  untouched.

**Waitlist consent:**
- Submit an address. Confirm it stores `confirmed: false`.
- Take the confirmation token for address A and try to confirm address B. Must
  fail.
- Confirm an address that never signed up. Must be refused, must not create.
- Unset `WAITLIST_TOKEN_SECRET`. Confirm no forgeable link is sent and the entry
  stays unconfirmed rather than being promoted.
- Exceed the rate limit. Expect `429`.
- Break the rate-limit store. Confirm the signup is **refused** (fail closed),
  not allowed through uncounted.
- Confirm the stored rate-limit key contains no raw IP address.

## Step 7 — accessibility and the published pages

- Run axe over `/product` in every state (empty, node selected, constraint
  violated) and over all seven policy pages. Serious and critical must be zero.
- The suite currently runs light theme only. Run **dark** theme too and report
  what it finds — that gap is known and undocumented in the specs.
- Keyboard-only: can you reach every control on `/product`? The canvas is
  pointer-driven; report honestly whether a keyboard user can build a graph.
  This is expected to be a real gap.
- Confirm `sitemap.xml` lists every policy page and that `robots.txt` points at a
  sitemap that exists.
- Confirm `og-image.png` and both PWA icons are real PNGs with correct
  dimensions, not text files with the right name. (This was an actual bug.)

## Step 8 — what is deliberately not done

Do **not** report these as defects. Confirm they are still honestly represented:

- No catalogue component is `SOURCED`. No kit is `VALIDATED`. Nothing has been
  physically built or measured. Any code that reports otherwise is a serious
  finding.
- Payments are off by design.
- Merchant fields (entity, address, CIN, GSTIN, jurisdiction) are conditional on
  `PAYMENTS_ENABLED` and absent while nothing is sold.

## Output I want

1. **Deploy verdict** — can this ship, and what is the minimum set of changes to
   make every write path work? Be specific about the storage decision.
2. **Findings table** — file:line, what breaks, how to reproduce, severity.
   Separate "wrong" from "risky" from "untidy".
3. **Guarantees that held** — say which of the honesty properties you attacked
   and could not break. This is as valuable as the failures.
4. **Coverage gaps** — what has no test at all. Name the specific behaviour, not
   the file.
5. **Anything the code claims about itself that is not true.** Rank this first if
   you find any.

Do not summarise favourably. If something is broken, the useful output is the
reproduction, not the reassurance.
