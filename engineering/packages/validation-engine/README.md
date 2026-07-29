# @logichub-engineering/validation-engine

Deterministic physical-rule kernel for LogicHub reference products.

v0.1 implements the **Sovereign Educational Console rule kernel**: five
versioned rule families evaluated by a deterministic engine with explicit
unit normalization, calculation traces, canonical (RFC 8785 JCS) output,
and SHA-256 result hashing.

| Rule ID | Purpose |
| --- | --- |
| `SEC-POWER-THERMAL-001` | Battery runtime, regulator dissipation, first-order thermal feasibility |
| `SEC-OPTICAL-CLASSIFICATION-001` | RGB/LDR token classification margin (nearest-centroid, explicit unknown/ambiguous) |
| `SEC-INTERFACE-INTEGRITY-001` | Pinout, voltage domains, ADC limits, daughterboard protection, hot-plug claims |
| `SEC-MECHANICAL-RUGGEDNESS-001` | Print envelope, tolerance stacks, bosses, wiring grooves, classroom ruggedness |
| `SEC-MANUFACTURING-ECONOMICS-001` | BOM, yield-adjusted cost, assembly, ex-factory cost, contribution margin |

Invariants:

- Missing numeric inputs **never** default to zero — they become explicit
  `MissingInput` records and drive the result to `unknown`.
- `unknown` is **never** treated as `pass`; physical-evidence-gated checks are
  `requires_validation` until evidence records exist.
- Confidence is a class (`deterministic_verified_inputs`,
  `deterministic_estimated_inputs`, `empirical_calibrated`, `heuristic`,
  `insufficient_evidence`) with a mandatory rationale — never a float.
- Canonical output bytes are reproducible run-to-run (tested 10×).
- The kernel calculates, compares, classifies, detects contradictions,
  identifies missing inputs, recommends physical tests, and generates records.
  It does **not** modify hardware files, approve designs, claim regulatory
  compliance, authorize manufacturing, replace physical tests, or invent
  missing datasheet values.

## CLI

```bash
cd engineering
pnpm --filter @logichub-engineering/validation-engine rule-kernel evaluate \
  --product reference-products/sovereign-educational-console/product.json \
  --case reference-products/sovereign-educational-console/cases/reference-v0.json \
  --out artifacts/rule-evaluation.json

# other subcommands
... rule-kernel validate --case <case.json>
... rule-kernel evaluate --product <p> --case <c> --rule SEC-POWER-THERMAL-001 --stdout
... rule-kernel explain SEC-OPTICAL-CLASSIFICATION-001
... rule-kernel compare --result <result.json> --outcome <outcome.json>
... rule-kernel replay-all --product <p> --cases-dir <dir> --out <report.json>
```

Reuses `Constraint`, `Decision`, and `ValidationResult` contracts from
`@logichub-engineering/contracts` — no duplicate schema definitions.
