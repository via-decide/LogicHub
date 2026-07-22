# Sovereign Educational Console — Reference Product v0.1

Frozen reference product for the first deterministic LogicHub physical-rule kernel.

A rugged, local-first educational console: an ESP32-C3 controller, a removable
8.5-inch monochrome LCD writing slate, four optical token-identification wells
(RGB illumination + LDR detection), a backlit translucent lesson-template
facade, a replaceable educational daughterboard, and a 3D-printed enclosure.
Local firmware only — no mandatory cloud connection.

## Status

- Product revision: `v0.1` — **frozen** (2026-07-22).
- Controller decision: **ESP32-C3-MINI-1** (see `decisions/DEC-001-controller-selection.json`).
  The ESP32-C3-or-RP2040 ambiguity is resolved; RP2040 is recorded as the
  rejected alternative.
- This is a *reference specification*, not a built or tested device. No
  physical measurements exist yet for this product. Nothing in this directory
  claims the product is certified, child-safe, classroom-safe,
  production-ready, or validated. See `validation-plan.md` and `risks.md`.

## Directory guide

| Path | Contents |
| --- | --- |
| `product.json` | The frozen machine-readable product contract (validated by `product.schema.json` and by the Zod schema in `@logichub-engineering/validation-engine`). |
| `architecture.md` | Human-readable frozen architecture for all six subsystems. |
| `interfaces.json` | Electrical/mechanical interfaces, including the keyed daughterboard connector. |
| `power-tree.json` | Rails, sources, regulators, and per-subsystem current budget. |
| `pin-map.json` | Exact ESP32-C3 pin assignments, incl. restricted strapping pins. |
| `bom.csv` | Preliminary normalized BOM (prices are estimates, marked as such). |
| `assumptions.json` | Every engineering assumption with provenance and evidence grade. |
| `constraints.json` | Typed constraints (conform to `@logichub-engineering/contracts` `ConstraintSchema`). |
| `validation-plan.md` | The 15 required physical tests. None executed yet. |
| `risks.md` | Unresolved-risk register. |
| `decisions/` | Decision records (conform to contracts `DecisionSchema`). |
| `rules/` | Human-readable docs for the five v0.1 rule contracts. |
| `cases/` | Evaluation cases and fixtures. `cases/synthetic/` holds synthetic fixtures which are **never** counted as historical evidence. |
| `reports/` | Historical replay reports, blocker reports, go/no-go report. |

## Evaluating the product

```bash
cd engineering
pnpm --filter @logichub-engineering/validation-engine rule-kernel evaluate \
  --product reference-products/sovereign-educational-console/product.json \
  --case reference-products/sovereign-educational-console/cases/reference-v0.json \
  --out artifacts/rule-evaluation.json
```

## Evidence policy

Every numeric value in this specification carries a provenance and an evidence
grade (`verified`, `datasheet`, `estimated`, `unknown`). No component datasheets
are currently part of the reviewed source corpus, so datasheet-dependent values
are marked `estimated` and the corresponding risks are registered. Missing data
is never silently treated as zero, and `unknown` is never treated as pass.
