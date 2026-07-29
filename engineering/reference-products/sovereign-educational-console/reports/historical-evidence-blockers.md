# Historical Evidence Blockers — Sovereign Educational Console v0.1

**Date**: 2026-07-22
**Verdict**: BLOCKED — 0 of 10 target cases have documented physical outcomes

## Current state

The kernel is ready. Five deterministic rules compile, pass type-checking, and produce byte-identical results across runs. The evidence to test those rules against reality does not exist.

## What is missing to reach 10 classifiable cases

### 1. Battery runtime test (validation-plan test 1)

- **What**: Full charge-to-floor discharge under simulated 4-hour classroom load, logged at 1 Hz minimum
- **Produces**: 1 case with `documented_physical_outcome` for SEC-POWER-THERMAL-001
- **Blocked by**: No prototype. No 1200 mAh protected Li-po cell procured. No logging hardware.
- **Evidence grade when completed**: `measured`

### 2. Charger thermal test (validation-plan test 2)

- **What**: TP4056 charge cycle in closed enclosure at 40 degC ambient, thermocouple on IC package
- **Produces**: 1 case with `documented_physical_outcome` for SEC-POWER-THERMAL-001
- **Blocked by**: No prototype. No TP4056 board. No thermocouple + logging setup. No environmental chamber or heated enclosure.
- **Evidence grade when completed**: `measured`

### 3. Optical calibration + classification test (validation-plan test 4)

- **What**: Per-bay RGB strobe readings with 4+ token colors, dark and ambient baselines, at least 5 samples per class
- **Produces**: 1 case with `documented_physical_outcome` for SEC-OPTICAL-CLASSIFICATION-001
- **Blocked by**: No prototype. No LDR dividers wired. No WS2812B LEDs sourced. No tokens printed.
- **Evidence grade when completed**: `measured`

### 4. Interface integrity bench check (validation-plan test 5)

- **What**: Pin-map vs. physical wiring audit, voltage-domain measurements on each ADC channel, daughterboard connector load test
- **Produces**: 1 case with `documented_physical_outcome` for SEC-INTERFACE-INTEGRITY-001
- **Blocked by**: No prototype. No multimeter/oscilloscope readings exist.
- **Evidence grade when completed**: `measured`

### 5. Mechanical fit verification (validation-plan tests 8-10)

- **What**: Caliper measurements on enclosure halves, token wells, slate pocket. Assembly clearance check. Screw boss torque test.
- **Produces**: 2 cases with `documented_physical_outcome` for SEC-MECHANICAL-RUGGEDNESS-001
- **Blocked by**: No 3D-printed enclosure. No calipers/measurements taken.
- **Evidence grade when completed**: `measured`

### 6. Drop test (validation-plan test 11)

- **What**: 76 cm (desk height) drop to concrete, 5 samples, document damage
- **Produces**: 1 case with `documented_physical_outcome` for SEC-MECHANICAL-RUGGEDNESS-001
- **Blocked by**: No prototype. No test rig.
- **Evidence grade when completed**: `measured`

### 7. Cost actuals reconciliation

- **What**: Actual BOM procurement receipts, timed assembly, measured scrap/rework rates over 10-unit pilot batch
- **Produces**: 1 case with `documented_physical_outcome` for SEC-MANUFACTURING-ECONOMICS-001
- **Blocked by**: No procurement. No assembly line. No batch production attempted.
- **Evidence grade when completed**: `measured`

### 8. Strap anchor load test (validation-plan test 12)

- **What**: Static pull test on strap anchors, document failure mode and load at failure
- **Produces**: 1 case with `documented_physical_outcome` for SEC-MECHANICAL-RUGGEDNESS-001
- **Blocked by**: No prototype. No tensile test fixture.
- **Evidence grade when completed**: `measured`

## Why the existing sources cannot fill the gap

| Source type | Count | Why it cannot produce a classifiable case |
|---|---|---|
| Design records (electronics repo) | 2 | No prototype was built; no measurements exist. The validation matrix explicitly says "execution pending." |
| Narrative claims (Daxini journals) | 3 | Numbers are stated without instrument identification, calibration, methodology, or raw data. Per kernel rules: narrative claims cap at `insufficient_evidence`. |
| Synthetic fixtures | 1 | Excluded by design — `not_applicable` classification. |
| Empty placeholders | ~20 | Evidence directories in electronics repo contain only placeholder READMEs. |

## Minimum path to 10 classifiable cases

1. Procure components per BOM (estimated lead time: 2-3 weeks for Indian suppliers)
2. Print enclosure (estimated: 6 hours Bambu A1)
3. Assemble 1 functional prototype
4. Execute validation-plan tests 1, 2, 4, 5, 8, 9, 10, 11, 12
5. Record each as an evidence artifact with SHA-256 content hashes per the electronics repo's evidence schema
6. Import as historical cases and re-run the kernel replay

This produces exactly 10 cases with documented physical outcomes — the minimum for the historical replay target.

## What cannot be fabricated

- Measurement data: every recorded value must come from an actual instrument reading
- Test outcomes: physical pass/fail must be observed, not predicted
- Historical depth: a batch of 10 tests performed in a single session provides 10 cases but zero independent replications
- Statistical generalization: even with 10 cases, confidence intervals will be wide

## Next action

**Build one prototype and run the battery-runtime + optical-calibration bench tests.** These two alone produce 2 classifiable cases and unblock the highest-value evidence gap (power rule and optical rule, which together cover the core product claims).
