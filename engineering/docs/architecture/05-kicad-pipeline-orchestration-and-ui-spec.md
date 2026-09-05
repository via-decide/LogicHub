Repository: "via-decide/logichub"
Repository URL: "https://github.com/via-decide/logichub.git"
Mode: "logichub-v0.1-engineering-repository-contract-phases-5-8"
Tier: T5
Estimated effort: 1200+ minutes
Version: 1.0
Primary implementation target: Claude Code
Scope status: Frozen for this task

Note: this document continues `00-master-task-spec.md` (the "LogicHub v0.1 Engineering
Repository Contract"). It does not replace it. Phases 0–4 of that spec are done and
tested — this document exists because an investigation of the actual codebase (not the
spec's own phase checklist, which nobody had cross-checked against reality) found that
Phases 5–8 are only partially built, in a way that isn't obvious from file listings
alone. Read this whole document, then read `00-master-task-spec.md` sections 11
(MERGE GATES), 12 (API CONTRACT), and 13 (WEB APPLICATION) before writing any code —
this document tells you what's already true on disk and what order to build in; that
document has the exact contracts (endpoint list, the 16 merge-gate conditions, the
required page/tab list) you must match exactly, not re-derive.

---

MASTER OBJECTIVE

Turn the already-built, already-tested KiCad import → fingerprint → semantic-diff
engine into an actual product: one orchestration layer, one merge-gate policy engine,
one HTTP API, and one browser UI that a person can use end to end — import a real
KiCad repo, open a branch, see a real diff, watch merge gates evaluate, approve, and
merge — without touching a REPL or a CLI flag.

Do not re-implement anything already built and tested (see section 1). Do not expand
scope beyond Phases 5 (remainder) through 8 of `00-master-task-spec.md`'s own phase
list (section 23). Do not build a general autonomous prompt-to-PCB generator, and do
not build any new file-parsing, git-plumbing, or semantic-diffing logic — every one of
those already exists.

---

1. WHAT ALREADY EXISTS — READ THE CODE, DO NOT REIMPLEMENT

Verified by running each package's own test suite in this session. Treat all of this
as a stable foundation you call into, not code you rewrite.

`@logichub-engineering/git-adapter` (68/68 tests passing)
- `GitExecutor`: runs `git` via argument arrays only, never a shell string; times out;
  bounds output; full audit log per call.
- `GitRepository`: `open`/`init`, `listBranches`/`createBranch`,
  `resolveCommitSha`/`readCommitMetadata`, `listChangedFiles`/`compareCommits`,
  `mergeBase`/`isAncestor`, `checkStaleBase` (advanced base *and* rewritten-history
  detection), `merge()` (fast-forward when possible, else conflict-safe
  `merge-tree --write-tree` + `commit-tree` + `update-ref <old> <expected-old>`, so a
  concurrent branch move raises `LH_REVISION_STALE` instead of clobbering; conflicts
  raise `LH_MERGE_BLOCKED` with the conflicted file list), `restoreWorkingTree` /
  `removeWorkingTree` via `git worktree add --detach`. Requires git ≥ 2.38.
- Use this for every git operation the orchestration layer needs. Do not shell out to
  git yourself anywhere else in the codebase.

`@logichub-engineering/kicad-adapter` (85 passing / 6 honestly skipped — no `kicad-cli`
in a sandboxed environment; the skip itself is the correct, tested behavior, not a gap)
- Real recursive-descent S-expression parser (`src/sexpr/parser.ts`).
- `parseSchematic()` / `parsePcb()` / `extractBom()`: real `.kicad_sch`/`.kicad_pcb`
  extraction — symbols, properties, power flags, nets, layers, footprints, pads,
  tracks/vias/zones, board outline, BOM grouping.
- `inspectProject()` / `validateProjectFiles()`: locates and parse-checks a
  `.kicad_pro`/`.kicad_sch`/`.kicad_pcb` triad, non-throwing diagnostics.
- `KicadAdapter` class (`src/operations.ts`): the façade — `inspectProject`,
  `validateProjectFiles`, `extractSchematicObjects`/`extractPcbObjects`/`extractBom`
  (→ `EngineeringObject[]` from `@logichub-engineering/contracts`),
  `renderSchematic`/`renderPcbLayers` (SVG via `kicad-cli`), `runErc`/`runDrc` (via
  `kicad-cli` or `python3 pcbnew`, honestly `skipped` when unavailable — never a
  fabricated result). Always operates on an isolated copy; never touches the source
  directory.
- Every object carries a `contentHash` (properties + geometry) and a `semanticHash`
  (properties only) — a pure move changes the former, not the latter. Reuse this
  distinction; do not invent a second hashing scheme.

`@logichub-engineering/repository-engine` (105/105 tests passing) — this is the
diff engine. Reuse it completely; do not write a second one.
- `buildFingerprint(repo, commitRef)`: whole-repo `FingerprintDescriptor` — source
  inventory + software surface + KiCad surface (via `kicad-adapter`, confirmed) + BOM
  surface + constraint surface + decision surface, JCS-canonicalized and SHA-256'd
  into one `descriptorHash`.
- `computeSemDiff(base, proposed)`: typed deltas across every domain
  (`API_ADDED/REMOVED`, `SIGNATURE_CHANGED`, `SYMBOL_VALUE_CHANGED`,
  `SYMBOL_FOOTPRINT_CHANGED`, `NET_ADDED/REMOVED`, `FOOTPRINT_ADDED/REMOVED/CHANGED`,
  `BOARD_OUTLINE_CHANGED`, `BOM_ITEM_ADDED/REMOVED`, `QUANTITY_CHANGED`,
  `MPN_CHANGED`, `CONSTRAINT_ADDED/CHANGED/REMOVED`, `DECISION_ADDED/SUPERSEDED`,
  `RELATION_ADDED/REMOVED`, and more), each with a `replayOperation`; move detection
  (content-hash based, so a rename isn't reported as remove+add); a BFS cross-domain
  `impact-analyzer` (depth ≤ 3) that also flags stale evidence; a `pr-summary-builder`
  that rolls all of this into an `EngineeringPrSummary` (breaking changes, changed
  nets, BOM risk, affected blocking constraints, required validations, review
  domains, deterministic merge blockers); a `replay-builder` whose `verifyReplay()`
  re-applies the ordered replay to base and checks it lands on proposed's state hash —
  a real correctness self-check.
- Three working CLIs already exist (`fingerprint`, `graphmap`, `semdiff`) — useful for
  manual testing, but the orchestration layer (section 3 below) must call the library
  functions directly, not shell out to its own CLIs.
- Real KiCad fixture pair already exists for testing:
  `engineering/fixtures/kicad/smart-plant-pot/{base,proposed}/*.kicad_{sch,pcb,pro}`.

`@logichub-engineering/persistence` (97/97 tests passing) — SQLite via
`better-sqlite3`, migrations, one repository per contract entity (`project`,
`revision`, `engineering-object`, `constraint`, `decision`, `artifact`,
`change-intent`, `validation-result`, `module`, `engineering-pull-request`).
`EngineeringPullRequestRepository` already enforces the PR state machine
(`transitionOrThrow`, `LH_STATE_TRANSITION_INVALID` on an invalid transition from a
terminal state). Content-addressed `ArtifactRepository` keyed by SHA-256. Use these
repositories for every read/write the API layer needs. Do not add a second
persistence mechanism.

`@logichub-engineering/contracts` — schemas, enums, generated JSON Schema, and state
machines for every entity above. `ChangeIntent`'s `requestedOperations` /
`expectedObjectChanges` / `constraints` fields are currently `z.array(z.unknown())` —
untyped placeholders. Part of this task is giving them real shapes (section 3.1).

`engineering/docs/workflows/kicad-import.md` documents the *actual, already-working*
import workflow (inspect → validate → extract → hash → persist → render/ERC/DRC →
record `ValidationResult`). It is accurate. Read it before touching import code.

---

2. WHAT NOT TO TOUCH OR CONFLATE

`@logichub-engineering/physical-ci`'s `Issue` / `Claim` / `PhysicalPullRequest` /
`PR_TRANSITIONS` is a **different, unrelated product surface** — a bounty-style
marketplace for physical hardware repair/qualification work (an `Issue` is a posted
job with a price-quote bounty; a `Claim` is a vendor claiming it; a
`PhysicalPullRequest` is that claim's sealed-telemetry submission, evaluated against
YAML tolerance rules). It reuses the same generic `transition()` state-machine helper
this codebase uses elsewhere, and the word "PullRequest" appears in both, but it has
zero type or code relationship to `git-adapter` / `kicad-adapter` /
`repository-engine` / `EngineeringPullRequest`. **Do not import from `physical-ci`,
do not reuse its state machine for the engineering-PR workflow, and do not merge these
two domains.** If a genuine connection between "a qualified vendor's telemetry" and
"an engineering PR's merge gates" turns out to be wanted later, that is a deliberate
future integration decision for a human to make, not something to default into here.

`apps/web/src/app/diff/page.tsx` is a hand-written static mockup (hardcoded
"Component Swap: LDO Regulator", "PR #142", fabricated before/after values). It
renders no real data and calls no API. Treat it as a design reference for visual
style only — replace its data with real API calls per section 5; do not treat its
existing content as a working feature to extend.

---

3. SCOPE OF THIS TASK

3.1 `@logichub-engineering/domain` (currently an empty README — this is the
orchestration hub ADR-0003 already designates for this job; read
`engineering/docs/decisions/adr-0001-engineering-platform-integration.md` and any
later ADR referencing `domain`/`review-engine` before writing code)

- Give `ChangeIntent`'s `requestedOperations` / `expectedObjectChanges` / `constraints`
  real, typed shapes in `@logichub-engineering/contracts` (still `z.array(...)`, but
  of a real schema, not `z.unknown()`). Base the shape on what
  `repository-engine`'s `DeltaRecord`/`ReplayOperation` types already carry — a
  `ChangeIntent` should be expressible as, and checkable against, the delta set a real
  diff produces, not a second, disconnected vocabulary.
- Implement the import pipeline exactly as `kicad-import.md` describes, wired to real
  persistence: given a git repo + ref, call `git-adapter` to resolve it,
  `kicad-adapter` to extract objects, `repository-engine.buildFingerprint` for the
  whole-repo descriptor, and `persistence` to store the `Project`/`Revision`/
  `EngineeringObject` rows and the snapshot hash. This almost certainly already works
  as a sequence of individually-tested calls — the job here is composing them into one
  function/service with one error-handling and transaction boundary, not writing new
  extraction logic.
- Implement revision comparison: given two revision IDs, load their stored
  fingerprints (or rebuild if not cached — decide which and document why), call
  `repository-engine.computeSemDiff`, and return the `EngineeringPrSummary` plus the
  full delta/impact/replay records.
- Implement constraint *evaluation* in the diff loop — this is the one piece Phase 5
  is missing (repository-engine only diffs which constraints changed as declared
  text; it does not evaluate whether the proposed revision's design actually
  satisfies them). Decide, and document the decision as an ADR: does this call
  `@logichub-engineering/validation-engine`'s SEC-* rules (they're a standalone
  deterministic kernel — check whether their `RuleInputs` shape can be populated from
  a `FingerprintDescriptor`/`EngineeringObject` set, or whether an adapter layer is
  needed), or a simpler constraint-only evaluator scoped to this task? Whatever you
  choose, a blocking constraint violation must be a real, computed boolean feeding
  merge gate #10 (section 3.2) — not a placeholder that always passes.
- Implement visual diff: given two revisions, call `kicad-adapter.renderSchematic` /
  `renderPcbLayers` for both, and produce a comparable pair (side-by-side is
  sufficient for v1; do not build pixel-diffing image processing — that's explicitly
  out of scope). If `kicad-cli` is unavailable, the visual-diff result must say so
  honestly (matching the exact `skipped`-not-fabricated convention `kicad-adapter`
  already uses for ERC/DRC) rather than silently omitting the tab.
- Write the missing end-to-end proof for Phase 5: a test that runs the full pipeline
  (fingerprint base → fingerprint proposed → semdiff) against the repo's own
  `fixtures/kicad/smart-plant-pot/{base,proposed}` pair and asserts the *specific*
  deltas that pair is known to contain (check `generate-fixtures.mjs` for what was
  deliberately changed between base and proposed) — not just "it runs without
  throwing." This is Phase 5's actual, still-unmet exit condition from section 23 of
  the master spec: "all intended fixture changes appear correctly."

3.2 `@logichub-engineering/review-engine` (currently an empty README — Phase 6)

- Implement the review workflow: submit a review (approve / request changes /
  comment), track approval count, track unresolved "request changes" state.
- Implement merge-gate evaluation as **exactly** the 16 numbered conditions in
  `00-master-task-spec.md` section 11 — copy them precisely, do not paraphrase or
  drop any: same-project check, ancestry check, staleness check, manifest integrity,
  artifact hash validity, schema validation, KiCad import validation, ERC/DRC
  blocking-failure checks, blocking-constraint check (feeds off 3.1's constraint
  evaluation), "no validation left unknown," required decision records, required
  approval count, no unresolved request-changes review, clean working tree, and the
  merge itself producing a new immutable revision. The spec is explicit: "Merge
  eligibility must be recalculated immediately before merge. Do not trust an earlier
  cached merge result" — implement `recalculate` as a real, side-effect-free
  re-evaluation, and call it again inside `merge`, not just before it.
- Implement the merge operation itself as a thin, careful wrapper around
  `git-adapter`'s already-conflict-safe `merge()` — do not reimplement merge
  mechanics; this layer's job is "gates all pass, therefore call the git layer's
  merge and record the resulting `PullRequest` state," nothing more.

3.3 `apps/api` (currently nothing — a README stub)

- Fastify (or an equivalent typed HTTP framework, per the master spec) implementing
  **exactly** the endpoint list in `00-master-task-spec.md` section 12 — the
  `/projects`, `/projects/:id/branches`, `/projects/:id/revisions/import`,
  `/projects/:id/change-intents`, `/revisions/:id/validate`,
  `/revisions/:base/diff/:head`, `/projects/:id/pull-requests`,
  `/pull-requests/:id/reviews`, `/pull-requests/:id/recalculate`,
  `/pull-requests/:id/merge`, `/artifacts/:id`, `/modules` set. Every endpoint calls
  into `domain`/`review-engine`/`persistence` — no business logic lives in the API
  layer itself.
- Per the spec's explicit requirements: validate every request, return typed errors
  with stable error codes (reuse `@logichub-engineering/shared`'s existing error-code
  conventions if any exist — check `shared/src/error-codes.ts`), never expose
  internal filesystem paths in a response, include a correlation ID on every
  request/response, and paginate every endpoint whose result set can grow
  (`GET /projects`, `/revisions`, `/pull-requests`, at minimum).

3.4 `apps/web` — real pages, per `00-master-task-spec.md` section 13, replacing the
mockups

- Projects list, project detail, revision detail, pull-request list, and the
  engineering pull-request view with its required 10 tabs (Overview, Intent, Files,
  Schematic, PCB, BOM, Constraints, Decisions, Validation, Reviews) and required
  actions (Comment, Approve, Request changes, Recalculate eligibility, Merge, Close) —
  read section 13 for the exact field list each page must show; do not shorten it.
- Every page reads from the real `apps/api` endpoints in section 3.3. No hardcoded
  sample data anywhere in this surface — the existing `/diff` mockup's visual style
  may inform the new pages' design, but none of its fabricated content should survive
  into the real implementation.
- The spec requires the UI to "clearly distinguish passing evidence" from
  estimated/unknown/missing evidence (section 13, continued past what's quoted
  above — read the rest of that section in the master spec before building the
  validation/constraints tabs). This matches the `EpistemicState` convention already
  used elsewhere in this codebase (`product-graph`, `generated-surfaces`) — reuse that
  visual language (measured vs. estimated vs. unknown) rather than inventing a new one.

3.5 Phase 8 — end-to-end validation

- A Playwright spec that drives the actual browser UI through: import the
  `smart-plant-pot` base fixture as a project → import the proposed fixture as a
  second revision on a branch → open the diff → open an engineering PR → see the
  merge-gate panel reflect real (not fabricated) gate results → approve → merge →
  confirm a new revision exists. This is the thing Phase 8 asks for
  ("run complete automated flow... verify deterministic outputs... verify artifact
  hashes") and nothing in the repo does yet.
- Re-run every existing package test suite (`git-adapter`, `kicad-adapter`,
  `repository-engine`, `persistence`, `contracts`) after this work lands, to confirm
  nothing in this task's wiring required changing their tested internals. If it did,
  that's a signal the orchestration layer is reaching into something it should be
  calling through a public API instead — fix the boundary, not the test.

---

4. NON-GOALS (explicit)

- No new git plumbing, S-expression parsing, or semantic-diff algorithm — sections 1
  and 2 exist to make this unambiguous.
- No pixel-level image diffing for the visual-diff feature — side-by-side rendered
  SVGs is the v1 bar.
- No AI-generated electrical approval, no AI output replacing ERC/DRC/schema
  validation/content hashing/constraint evaluation/human approval — the master spec
  states this explicitly (its section on required guarantees) and it applies here
  without exception: a merge gate's pass/fail must come from the deterministic
  checks in section 3.2, never from a model's judgment call.
- No connection to `physical-ci`'s marketplace domain (section 2).
- No expansion of `engineering-graph` unless section 3.1's constraint-evaluation work
  turns out to genuinely need a persisted, queryable graph beyond what
  `repository-engine`'s in-memory `graphmap` already provides for a single diff — if
  you reach for it, write down why `repository-engine`'s existing graph wasn't
  enough before adding a second graph implementation.

---

5. VERIFICATION

For each phase above, in order:

1. `domain` (3.1): existing package test suites still pass unmodified; the new
   fixture-pair semdiff test asserts specific, named deltas and passes; a constraint
   violation introduced deliberately into the proposed fixture is detected and
   reported as blocking.
2. `review-engine` (3.2): unit tests for all 16 merge-gate conditions, independently
   toggled (each condition has at least one test proving it alone blocks merge when
   failing, and does not block when passing with all others green); a `recalculate`
   call after a base has advanced correctly flips a previously-eligible PR to
   ineligible.
3. `apps/api` (3.3): every endpoint in section 12 responds correctly to the golden
   path and to at least one invalid-input case; pagination is exercised on a
   multi-page result set.
4. `apps/web` (3.4): each required page renders real data from a running `apps/api`
   instance backed by the fixture project; no page contains hardcoded sample values.
5. Phase 8 (3.5): the full Playwright flow passes against a clean database; hashes
   recorded at each step are re-verified rather than only asserted-present.

Do not report this task complete until step 5 passes against the actual
`smart-plant-pot` fixture pair, end to end, in a real browser — not a unit test
standing in for it.
