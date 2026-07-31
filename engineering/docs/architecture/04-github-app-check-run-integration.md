# GitHub App & Check Run Integration: Making the Gate Actually Block

**Status:** Design proposal. Nothing in this document is implemented.

## The problem this solves

`engineering/packages/physical-ci/src/pipeline/merge-gate.ts` already implements a
merge gate: `PR_STATES`, `PR_TRANSITIONS`, no edge from `FAILED` back to `PASSED`,
`MERGED` terminal. 92 tests cover it.

It gates nothing outside itself.

The states live in a Postgres row. No git host consults them, no merge button
is disabled by them, and nothing prevents a maintainer merging a change whose
LogicHub verdict is `FAILED` — or that LogicHub never saw. The gate is an
internal record of a decision, not an enforcement of one.

A GitHub App posting **Check Runs** is the mechanism that converts the existing
verdict into an actual block, because a failing Check Run selected in branch
protection disables the merge button at the host. That is the whole point of
this integration: not new analysis, but binding the analysis already written to
the surface where the merge happens.

## Scope decision: two gates, not one

There are two different things LogicHub can gate, and conflating them produces a
confused design. Keep them separate.

**Gate A — design-time.** A GitHub PR changes hardware design files (KiCad
schematics, PCB layouts, BOM CSVs, mechanical CAD, firmware). This is a normal
PR with a diff, and the existing `validation-engine` rules
(`sec-power-thermal-001`, `sec-interface-integrity-001`,
`sec-mechanical-ruggedness-001`, `sec-optical-classification-001`,
`sec-manufacturing-economics-001`) evaluate the *declared design*. Verdict is
available in seconds. This is the literal "GitHub for Hardware" story and it is
what a Check Run is naturally shaped for.

**Gate B — physical.** A vendor builds a unit and submits telemetry
(`api/marketplace/submit.js`), which `run-ci.js` evaluates against the issue's
`rulesetYaml`. Verdict depends on a physical object existing and being measured.
It can take days, and it is what the marketplace flow in
`packages/physical-ci/src/marketplace/workflow.ts` already models.

Gate A is the first integration to build. Gate B is the more interesting one and
is covered in "The long-running check" below — it is where this differs from
every software CI product, and it is the reason the design should not simply
copy Autter.

## The status mapping is the crux

`validation-engine`'s `RuleResultStatusSchema` has **seven** states. GitHub Check
Run `conclusion` has **seven** too, but they are not the same seven and the
mapping is where the engineering judgement lives.

The governing constraint is stated in `rule-result.schema.ts`'s own docstring:

> `unknown` is never `pass`; `requires_validation` marks results that are
> calculable but gated on physical evidence.

That is the honesty principle from the manuscript expressed as a type. A naive
mapping that sends `unknown` to `neutral` (which does not block) silently
destroys it — the one property the whole platform is arguing for. So:

| `RuleResultStatus` | Check Run `conclusion` | Blocks merge? | Why |
|---|---|---|---|
| `pass` | `success` | no | — |
| `fail` | `failure` | **yes** | A rule was evaluated and the design violated it. |
| `error` | `failure` | **yes** | Tool failure is not absence of a problem. A rule that could not run has not passed; treating it as neutral is how a broken analyzer silently becomes a green check. |
| `unknown` | `failure` | **yes** | Required input was missing. Per the schema's own rule, `unknown` is never `pass` — and a conclusion that does not block *is* a pass in practice. |
| `requires_validation` | `action_required` | **yes** | Calculable, but gated on physical evidence that does not exist yet. Blocks, and `action_required` renders a Resolve link, which is the correct affordance: a human must supply evidence or waive. |
| `ambiguous` | `action_required` | **yes** | Two classes inside the ambiguity margin. The engine explicitly declines to decide; a human must. |
| `warning` | `neutral` | no | The only non-blocking non-pass. Surfaced as a `warning` annotation. |

Only `pass` and `warning` let a merge through. Everything else — including every
form of *not knowing* — blocks. That asymmetry is the product.

**Aggregation across rules:** the worst status wins. `rule-result.schema.ts`
already defines a severity ordering ("Pass is weakest") — reuse it rather than
writing a second ranking that can drift.

## Annotations: a real gap, stated plainly

GitHub annotations anchor to `path` + `start_line`. They are what makes a finding
land on the offending line instead of in a summary blob.

`RuleResult` has **no file or line anchors.** `affectedObjects` is an array of
object identifier strings, not source locations. `inputProvenance` maps input
names to provenance strings, which is closer, but still not a path and a line.

So one of these has to happen, and the choice should be deliberate:

1. **Extend `RuleResult`** with an optional `sourceLocations: {objectId, path,
   startLine, endLine}[]`, populated by whichever adapter parsed the file
   (`kicad-adapter` knows which file and element it read a value from). Correct,
   and more work.
2. **Resolve at post time** — keep `RuleResult` clean and have the GitHub App
   map `affectedObjects` → path via the repository's own manifest. Cheaper, and
   the mapping lives with the integration rather than polluting the engine.
3. **Ship file-level annotations only** (path, `start_line: 1`) and put the
   detail in `output.text`. Honest, immediately shippable, visibly cruder.

Option 2 first, option 1 when adapters can supply it. Do not silently ship
option 3 while describing it as line-level.

**Hard limit:** 50 annotations per API request, appended (not replaced) across
subsequent `PATCH` calls. A power/thermal rule over a large board can exceed
that. Batch in chunks of 50 and put the aggregate count in `output.summary`, so
a truncated list never reads as a complete one.

## Check Run lifecycle

```
pull_request opened/synchronize
  │
  ▼
POST /repos/{owner}/{repo}/check-runs
  { name: "LogicHub / design gate", head_sha, status: "queued" }
  │
  ▼  (worker picks up)
PATCH status: "in_progress"
  │
  ▼  validation-engine runs over the changed design files
PATCH {
  status: "completed",
  conclusion: <mapped above>,
  output: {
    title:   "3 rules failed, 1 requires physical evidence",
    summary: <markdown: per-rule verdict table>,
    text:    <markdown: trace steps, thresholds, assumptions, unknowns>,
    annotations: [ ...max 50 per call... ]
  }
}
```

`output.text` is where LogicHub has something no software CI product can offer:
`RuleResult.trace` is an array of `TraceStep {step, formula, inputs, output,
unit}` — a full deterministic calculation trace. Rendered as a markdown table,
a reviewer sees *why* the thermal margin failed, with the formula and the
numbers, not just that it did. Include `assumptions`, `unknowns`, and
`confidenceRationale` alongside it; those fields exist precisely so a verdict
can be argued with.

`output.text` caps at 65535 characters — truncate the trace, never the
`unknowns` list.

## The long-running check (Gate B)

This is the part worth building carefully, because it is the actual "GitHub for
Hardware" claim and it has no software analogue.

A design-time check completes in seconds. A **physical** check cannot: the unit
has to be manufactured and measured. So:

```
PR opens changing a released design
  → Check Run "LogicHub / physical evidence"  status: in_progress
    conclusion: (none yet)
  → stays in_progress for hours or days — legitimately
  → vendor submits telemetry via api/marketplace/submit.js
  → run-ci.js evaluates against rulesetYaml
  → PATCH conclusion: success | failure
```

An `in_progress` Check Run blocks the merge for as long as it stays that way.
That is not a limitation to work around; it is the correct behaviour. **The
merge button stays disabled until a physical object has been measured.** No
software CI system has a reason to express that, and it is exactly what the
manuscript means by verification before production.

Two things this needs that the current code does not have:
- A binding from a GitHub PR (`head_sha`) to a marketplace `pullRequestId`.
  Neither entity currently knows the other exists.
- A timeout policy. A check that stays `in_progress` forever is indistinguishable
  from a broken integration. Set a deadline (`requiredTests` and the issue's
  ruleset can inform it) after which the conclusion becomes `action_required`
  with an explicit "physical evidence not submitted within window" message —
  never `neutral`, which would let it merge unverified.

## GitHub App configuration

**Permissions (minimum):**
| Scope | Access | Why |
|---|---|---|
| Checks | Read & write | Create and update Check Runs. The core requirement. |
| Contents | Read | Fetch changed design files to evaluate. |
| Pull requests | Read | PR metadata, changed-file list. |
| Metadata | Read | Mandatory for all apps. |

Do **not** request Contents: write. LogicHub evaluates and reports; it does not
author commits. A gate that can rewrite the thing it gates is not a gate.
(Fix-PR generation, if ever wanted, is a separate app with a separate
justification.)

**Webhook events:** `pull_request` (opened, synchronize, reopened),
`check_run` (rerequested — the "Re-run" button), `installation` /
`installation_repositories` (track which repos are enrolled).

**Enforcement is not automatic.** Creating a Check Run does not block anything
by itself. The repository must add the check to branch protection
("Require status checks to pass before merging" → select `LogicHub / design
gate`). Until an admin does that, every verdict is advisory. This must be stated
plainly in onboarding, or LogicHub inherits exactly the failure mode the
manuscript names: *a check you can ignore is just advice.* Surface the
unprotected state in the UI rather than letting an installer assume enforcement
they do not have.

## Where this plugs in

New package `engineering/packages/github-app/`, following the existing pattern
(Zod schemas, pure functions, vitest):

```
src/
  schemas/check-run.schema.ts     GitHub Check Run request/response types
  mapping/status-mapping.ts       RuleResultStatus -> conclusion (the table above)
  mapping/annotations.ts          CheckFinding[] -> annotation[], 50-chunked
  render/summary.ts               RuleResult[] -> output.summary markdown
  render/trace.ts                 TraceStep[] -> output.text markdown
  webhook/verify.ts               HMAC-SHA256 signature verification
  webhook/handlers.ts             pull_request / check_run event handling
```

Serverless entry points in `api/github/` mirroring `api/marketplace/`:
`webhook.js` (event receiver), `install.js` (installation callback).

**Reuse, do not duplicate:** the severity ordering already in
`rule-result.schema.ts`; `validation-engine`'s existing rule registry; and
`_pg.js` for persisting installation → repo → project bindings.

## Security

Webhook payloads **must** be verified against `X-Hub-Signature-256` (HMAC-SHA256
over the raw body) before parsing. An unverified webhook endpoint lets anyone
post a `success` conclusion for any commit — which turns the gate into a
decoration. Use `crypto.timingSafeEqual`, and verify against the **raw** body:
Vercel's default JSON body parsing destroys the bytes the signature was computed
over, so the raw body must be captured before parsing.

App private key and webhook secret go in Vercel env only. Given
`LogicHub/.env` was committed to a public repo for 29 days (see commit
`01b1104`), that is not a theoretical caution.

Installation tokens are short-lived and scoped per installation — mint per
request, never cache across installations.

## Testing

`packages/physical-ci` sets the standard at 92 tests. Match it:

- **Every one of the 7 `RuleResultStatus` values** maps to the documented
  conclusion — table-driven, so a new status added later fails the test rather
  than silently defaulting to something non-blocking.
- **`unknown` and `error` produce a blocking conclusion.** This is the regression
  test that matters most; it is the property most likely to be "simplified" away
  by someone who finds the checks noisy.
- Aggregation returns the worst status across mixed rule results.
- Annotation batching: 137 findings produce 3 requests, none exceeding 50.
- `output.text` truncation preserves `unknowns` when the trace is dropped.
- Webhook signature verification rejects a tampered body and a wrong secret.
- Long-running check: deadline expiry yields `action_required`, never `neutral`.

## What this does not solve

- **Nothing here validates a physical object.** Gate A checks a declared design
  against rules. A passing design gate says the declaration is self-consistent,
  not that a manufactured unit conforms. Do not let the green check imply
  otherwise in any UI copy.
- **`prepare: false` / pooler constraints** apply to any DB writes on this path
  (see `api/_pg.js`).
- **The royalty gate is still absent.** `PASSED → MERGED` remains direct, with
  no `ROYALTY_PENDING`/`ROYALTY_CONFIRMED`. If a GitHub App ever unlocks a real
  merge button, it will unlock it *before* the creator has been paid — which
  inverts the protection the platform claims. Close that gap before this
  integration touches a live repository.
