# Sovereign Educational Console v0.1 — Unresolved-Risk Register

Risks are open until closed by imported evidence (datasheets, vendor quotes,
bench measurements). Closing a risk requires updating `assumptions.json` and,
where applicable, re-running the rule kernel.

| ID | Domain | Risk | Current evidence | Required closure |
| --- | --- | --- | --- | --- |
| R-01 | Controller | All ESP32-C3 electrical limits (GPIO current, ADC range, MCU current) are estimates; the datasheet is not in the reviewed corpus. A wrong ADC ceiling invalidates the optical chain design. | estimated | Import ESP32-C3 + ESP32-C3-MINI-1 datasheets; re-verify pin-map.json limits |
| R-02 | Controller | I2C on strapping pins GPIO8/9: a daughterboard that drives SCL low during reset can force download mode (console appears dead). | design note only | Bench test reset behavior with representative daughterboards; consider I2C buffer or pin move if failures observed |
| R-03 | Power | Generic TP4056 modules provide no load sharing; charging while operating without the DEC-002 power-path never terminates charge correctly and stresses the cell. | design obligation recorded | Implement power-path; validation-plan test 2 with charge-while-operate profile |
| R-04 | Power | Enclosure effective thermal resistance is unknown; all enclosure temperature margins are requires_validation. LDO/charger may exceed 85 degC or the 48 degC touch limit inside a closed PETG box at 40 degC ambient. | unknown | Validation-plan tests 2-3 |
| R-05 | Supply chain | No vendor quotes or lifecycle statements exist for the controller, slate module, or battery. Unit prices in bom.csv are estimates; cost conclusions inherit this uncertainty. | estimated | Two Indian distributor quotes per line at 3/25/100 units; Espressif longevity statement |
| R-06 | Optical | No confusion matrix exists. Token-color separability under ambient drift and filament-batch variation is unproven; classifier margins may collapse in bright classrooms. | unknown | Validation-plan tests 4-8 |
| R-07 | Optical | LDR part-to-part tolerance (typically wide) may exceed the per-device calibration envelope. | unknown | Device-to-device calibration spread measurement across >= 5 units |
| R-08 | Mechanical | Strap anchors and drop resistance are untested; a strap failure drops the console at carry height. No drop or load rating is claimed. | unknown | Validation-plan tests 11, 14 + strap-anchor load test before any carry-strap shipment |
| R-09 | Mechanical | Slate module dimensions are estimates; a pocket cut for 226 x 146 x 5 mm may jam or rattle with a different vendor's module. | estimated | Import vendor drawing; validation-plan test 12 |
| R-10 | Manufacturing | Material cost subtotal in bom.csv (~INR 1193) already exceeds the INR 850 ex-factory target before labor, yield, testing, packaging, warranty, and logistics. The target is at risk; the economics rule reports this deterministically. | estimated | Re-quote BOM at volume; revisit slate/battery/controller cost drivers; founder decision on target vs spec |
| R-11 | Safety | No toy-safety, small-parts, or electrical-safety certification evidence exists. The product must not be represented as certified, child-safe, or classroom-safe. Supervised-use-only model is mandatory messaging. | none | Formal test-lab engagement (out of scope for v0.1) |
| R-12 | Firmware | ADC sampling during WS2812 strobe may pick up switching noise; settling time 5 ms is an estimate. | estimated | Bench: scope the LDR node during strobe; adjust settling time |
