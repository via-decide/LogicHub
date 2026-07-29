# Evidence Request List

This list specifies the evidence artifacts that produce the highest-value kernel results. Items are ordered by impact on evaluation quality.

## Priority 1 — Required for any meaningful evaluation

| # | Evidence artifact | Rule(s) affected | Without it |
|---|---|---|---|
| 1 | Battery capacity + derating factor (datasheet or measured discharge curve) | POWER-THERMAL | Runtime is `unknown` |
| 2 | Subsystem current draws with duty cycles | POWER-THERMAL | Average load is `unknown` |
| 3 | Pin map with voltage domains and strapping pins | INTERFACE-INTEGRITY | All pin checks are `unknown` |
| 4 | BOM with unit costs | ECONOMICS | Material cost is `unknown` |
| 5 | Enclosure dimensions (at least largest printed part) | MECHANICAL | Print-envelope check is `unknown` |

## Priority 2 — Required for non-trivial results

| # | Evidence artifact | Rule(s) affected | Without it |
|---|---|---|---|
| 6 | Regulator topology + input/output voltages | POWER-THERMAL | Dissipation and thermal checks are `unknown` |
| 7 | Thermal resistance (junction-to-ambient) — even estimated | POWER-THERMAL | Temperature estimate refused; `unknown` |
| 8 | ADC resolution + saturation ceiling | OPTICAL | Classification margin is `unknown` |
| 9 | Calibration samples (RGB per class, dark reading, ambient) | OPTICAL | All optical checks are `unknown` |
| 10 | Connector keying + orientation documentation | INTERFACE | Mirrored-insertion check is `unknown` |
| 11 | Print material + layer height + nozzle diameter | MECHANICAL | Process-minimum checks are `unknown` |
| 12 | Fastening details (screw diameter, boss dimensions) | MECHANICAL | Boss geometry check is `unknown` |

## Priority 3 — Upgrades confidence class

| # | Evidence artifact | Rule(s) affected | Impact |
|---|---|---|---|
| 13 | Measured thermal resistance (bench test) | POWER-THERMAL | Upgrades from `requires_validation` to `pass` (if within margin) |
| 14 | Assembly hours + labor rate | ECONOMICS | Enables ex-factory cost calculation (currently `unknown`) |
| 15 | Yield / scrap data from pilot batch | ECONOMICS | Enables margin statement (currently blocked by completeness gate) |
| 16 | Drop test results (76 cm desk-height, 5 samples) | MECHANICAL | Upgrades from `requires_validation` to `pass`/`fail` |
| 17 | Strap anchor pull test | MECHANICAL | Upgrades from `requires_validation` to `pass`/`fail` |

## How to provide evidence

Each evidence artifact should include:
- **The value** (numeric with explicit unit)
- **The source** (datasheet URL, instrument model, test report reference)
- **The evidence grade** (measured / datasheet / estimated / unknown)
- **Date of measurement** (if applicable)

We normalize all inputs to canonical units automatically. You do not need to convert units yourself.
