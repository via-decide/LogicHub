# Design Review Scope

## In scope

### Rule coverage (5 rules, v0.1.0)

| Rule | What it evaluates |
|------|-------------------|
| SEC-POWER-THERMAL-001 | Battery runtime, regulator dissipation, thermal margins, charger conditions |
| SEC-OPTICAL-CLASSIFICATION-001 | RGB/LDR classification margins, calibration adequacy, ambiguity thresholds |
| SEC-INTERFACE-INTEGRITY-001 | Pin conflicts, voltage domains, ADC limits, connector keying, protection |
| SEC-MECHANICAL-RUGGEDNESS-001 | Print envelope, tolerance stacks, fastening, wiring, drop readiness |
| SEC-MANUFACTURING-ECONOMICS-001 | BOM, yield-adjusted cost, assembly, ex-factory, contribution margin |

### Deliverables per review

1. Product JSON (frozen specification normalized to kernel schema)
2. Case JSON (evaluation inputs extracted from your design documents)
3. Evaluation document JSON (full rule results with traces)
4. Human-readable report (findings + action items)
5. Evidence gap list (what physical tests are needed)

## Out of scope

- Regulatory compliance (CE, FCC, UL, BIS, or any other standard)
- Safety certification of any kind
- EMC/EMI analysis
- Firmware review or security audit
- Supply chain risk assessment beyond BOM cost estimation
- Design modification or optimization (we report findings; you decide actions)
- Physical testing (we specify what tests are needed; we do not run them)
- Legal advice on product liability

## Applicability

This review is most useful for products that include:
- Battery-powered operation
- Printed (FDM/SLA) enclosures
- Sensor-based classification or detection
- Multi-voltage-domain PCB design
- Cost-constrained manufacturing

Products outside these categories may still benefit but some rules will produce `not_applicable` results.
