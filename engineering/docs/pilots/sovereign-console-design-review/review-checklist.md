# Design Review Checklist

Internal checklist for conducting a pilot design review. Complete each step before delivering the report.

## Pre-review

- [ ] Customer intake form received and reviewed for completeness
- [ ] Missing intake fields documented in evidence gap list
- [ ] Product JSON created from intake data (all values carry provenance + evidence grade)
- [ ] Case JSON created with evaluation intent capturing the customer's stated decision
- [ ] Product and case schemas validate (`rule-kernel validate --product ... --case ...`)

## Evaluation

- [ ] Full evaluation run (`rule-kernel evaluate --product ... --case ... --out ...`)
- [ ] All 5 rules produce results (no uncaught errors)
- [ ] 10x determinism check: re-run and verify document hash matches
- [ ] Review each rule result for reasonableness:
  - [ ] SEC-POWER-THERMAL-001: runtime, dissipation, thermal estimates
  - [ ] SEC-OPTICAL-CLASSIFICATION-001: classification margins, calibration adequacy
  - [ ] SEC-INTERFACE-INTEGRITY-001: pin conflicts, voltage domains, protection
  - [ ] SEC-MECHANICAL-RUGGEDNESS-001: envelope, tolerances, strap/drop status
  - [ ] SEC-MANUFACTURING-ECONOMICS-001: BOM, cost, margin statement (or completeness gate)
- [ ] Verify no `pass` status on a rule with missing required inputs
- [ ] Verify `unknown` fields have corresponding unknowns entries in results
- [ ] Check trace steps for arithmetic reasonableness (spot-check 2-3 calculations)

## Report writing

- [ ] Findings organized by severity (fail > warning > requires_validation > unknown > pass)
- [ ] Each finding references the specific check and threshold
- [ ] Evidence gaps listed with priority (what would change the result)
- [ ] No claims of safety, certification, or regulatory compliance
- [ ] No unsourced marketing statements presented as engineering facts
- [ ] Disclaimer included in report header
- [ ] Confidence class explained for each rule

## Delivery

- [ ] Report delivered to customer with evaluation JSON
- [ ] Feedback form sent
- [ ] Pilot tracker updated with delivery date and status
