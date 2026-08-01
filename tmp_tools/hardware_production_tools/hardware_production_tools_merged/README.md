# Hardware Production Tools — Merged Bundle

This archive merges the 14 standalone HTML hardware production tools generated from the 14-project research ZIP workflow.

## Contents

- `index.html` — dashboard for the merged tool set.
- `html/` — standalone HTML tools, one file per tool.
- `individual_zips/` — original ZIP package for each individual tool.
- `tools_extracted/` — extracted contents of each individual tool ZIP.
- `manifests/tools_index.csv` — ordered tool inventory.
- `manifests/project_tool_matrix.csv` — mapping from 14 research projects to applicable tools.
- `manifests/tool_bundle_manifest.json` — machine-readable bundle manifest.
- `manifests/file_hashes.csv` — SHA256 hash ledger for all files in this merged archive.

## Tool order

1. **Power Standardization & Protection** — `tool-01-power-standardization-protection.html` — USB-C, battery input, fuse, reverse protection, power tree
2. **Tactile Determinism / Input FSM** — `tool-02-tactile-determinism-input-fsm.html` — Buttons, encoders, E-stop input, debounce, interrupt FSM
3. **State Visibility & Offline Telemetry** — `tool-03-state-visibility-offline-telemetry.html` — OLED, LEDs, buzzer, local logs, state codes
4. **Poka-yoke Interface Geometry** — `tool-04-poka-yoke-interface-geometry.html` — Cartridge slot, docking, keyed connectors, guide rails
5. **Fault Tolerance & Fallbacks** — `tool-05-fault-tolerance-fallbacks.html` — Watchdog, SPI/I2C timeout, safe reset, fault display
6. **Source Manifest + BOM/CAD Hash Intake** — `tool-06-source-manifest-bom-cad-intake.html` — Hashing, manifest, license, CAD/BOM source tracking
7. **Storage Integrity + Transactional Updates** — `tool-07-storage-integrity-transactional-updates.html` — CRC/SHA, dual manifest, rollback, flash layout
8. **Sensor Calibration + Health Evidence** — `tool-08-sensor-calibration-health-evidence.html` — IMU, camera, LiDAR, optics, RF, encoder calibration
9. **Actuator / Motor / Heater Safety Interlock** — `tool-09-actuator-motor-heater-safety.html` — Motors, heaters, relays, gantry, E-stop, arm/disarm
10. **Thermal / Current / Power Derating** — `tool-10-thermal-current-power-derating.html` — Heat, current, runtime, regulator, chamber, battery
11. **Local API / Edge Service Interface** — `tool-11-local-api-edge-service-interface.html` — HTTP, MQTT, serial, WebSocket, local-first dashboard
12. **Manufacturing QA Fixture + Test Receipts** — `tool-12-manufacturing-qa-fixture-receipts.html` — PCBA tests, commissioning, supplier acceptance
13. **Enclosure / Environmental DFM** — `tool-13-enclosure-environmental-dfm.html` — 3D print, injection moulding, guards, weatherproofing
14. **Compliance / Safety Risk Ledger** — `tool-14-compliance-safety-risk-ledger.html` — Product safety, India compliance, blocked claims, waivers

## Completion state

All 14 hardware production tools are complete. The next natural step is either:

1. merge these tools into the wider `hardware_research_progress_archive`, or
2. start the remaining project research ZIP: Libre Solar BMS / charge-controller bundle.
