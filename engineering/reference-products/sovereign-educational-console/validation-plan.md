# Sovereign Educational Console v0.1 — Physical Validation Plan

**Status: NONE of these tests has been executed.** No physical measurements
exist for this product. The rule kernel recommends these tests; it never claims
they passed without supplied evidence records. Evidence records must reference
raw artifacts (logs, images, instrument exports) with SHA-256 hashes.

| # | Test | Subsystem | Feeds rule | Blocking constraints | Minimum instrumentation |
| --- | --- | --- | --- | --- | --- |
| 1 | Battery runtime test — full charge to 3.5 V floor at default brightness, logged current | Power | SEC-POWER-THERMAL-001 | con-sec-runtime-4h, con-sec-battery-discharge-floor | USB power logger or shunt + logging DMM |
| 2 | Charger-temperature test — 500 mA charge from empty, enclosure closed, 40 degC ambient | Power | SEC-POWER-THERMAL-001 | con-sec-component-temp-85, con-sec-touch-temp-48 | thermocouple/thermal camera |
| 3 | Maximum-backlight thermal test — 100 % backlight for 1 h, enclosure closed | Power | SEC-POWER-THERMAL-001 | con-sec-component-temp-85, con-sec-touch-temp-48 | thermocouple on LDO + surface probe |
| 4 | Optical dark calibration — dark readings all 4 bays, tokens absent | Optical | SEC-OPTICAL-CLASSIFICATION-001 | — | firmware calibration dump |
| 5 | Optical bright-ambient calibration — direct classroom-window ambient | Optical | SEC-OPTICAL-CLASSIFICATION-001 | — | lux meter + calibration dump |
| 6 | Token confusion-matrix test — every token class x every bay x N=20 insertions | Optical | SEC-OPTICAL-CLASSIFICATION-001 | — | firmware classification log |
| 7 | Filament-batch variation test — same token geometry printed from 2+ batches | Optical | SEC-OPTICAL-CLASSIFICATION-001 | — | classification log per batch |
| 8 | Token insertion repeatability — one token, 50 insertions, response spread | Optical | SEC-OPTICAL-CLASSIFICATION-001 | — | classification log |
| 9 | Daughterboard overcurrent test — programmable load beyond 100 mA on 3V3 pin, verify PPTC trip | Interface | SEC-INTERFACE-INTEGRITY-001 | — | electronic load + DMM |
| 10 | Reversed-connector prevention test — attempt rotated/offset insertion with fixture force | Interface | SEC-INTERFACE-INTEGRITY-001 | con-sec-no-hot-plug (adjacent) | force gauge |
| 11 | Screw-boss torque test — torque-to-strip on sacrificial bosses, both layer orientations | Mechanical | SEC-MECHANICAL-RUGGEDNESS-001 | — | torque screwdriver |
| 12 | Slate insertion/removal cycling — 200 cycles, pocket wear and retention check | Mechanical | SEC-MECHANICAL-RUGGEDNESS-001 | — | calipers + inspection log |
| 13 | Wiring-groove retention test — vibration + inversion, no conductor escape | Mechanical | SEC-MECHANICAL-RUGGEDNESS-001 | con-sec-no-bare-conductors | inspection log |
| 14 | Controlled drop test — 0.8 m onto hard floor, corners and faces, powered | Mechanical | SEC-MECHANICAL-RUGGEDNESS-001 | con-sec-drop-untested | video + inspection log |
| 15 | Assembly-time measurement — 3 units, timed, by the intended assembler | Manufacturing | SEC-MANUFACTURING-ECONOMICS-001 | con-sec-cost-target | stopwatch + step log |

## Evidence format

Each executed test must produce an evidence record containing: test id, date,
operator, device serial/revision, instrument identity, raw-artifact paths with
SHA-256 hashes, numeric results with units, and pass/fail against the
constraint thresholds. Evidence records are the only mechanism that can move a
`requires_validation` constraint to `pass`.
