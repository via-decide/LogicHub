# HTML Tool Generation Plan

When the user says **next**, generate one HTML tool at a time in this order.

| Order | HTML tool file | Scope |
|---|---|---|
| 1 | `tool-01-power-standardization-protection.html` | USB-C, battery, fuse, reverse protection, power tree |
| 2 | `tool-02-tactile-determinism-input-fsm.html` | Buttons, encoders, E-stop input, debounce, interrupt FSM |
| 3 | `tool-03-state-visibility-offline-telemetry.html` | OLED, LEDs, buzzer, local logs, state codes |
| 4 | `tool-04-poka-yoke-interface-geometry.html` | Cartridge slot, docking, keyed connectors, guide rails |
| 5 | `tool-05-fault-tolerance-fallbacks.html` | Watchdog, SPI/I2C timeout, safe reset, fault display |
| 6 | `tool-06-source-manifest-bom-cad-intake.html` | Hashing, manifest, license, CAD/BOM source tracking |
| 7 | `tool-07-storage-integrity-transactional-updates.html` | CRC/SHA, dual manifest, rollback, flash layout |
| 8 | `tool-08-sensor-calibration-health-evidence.html` | IMU, camera, LiDAR, optics, RF, encoder calibration |
| 9 | `tool-09-actuator-motor-heater-safety.html` | Motors, heaters, relays, gantry, E-stop, arm/disarm |
| 10 | `tool-10-thermal-current-power-derating.html` | Heat, current, runtime, regulator, chamber, battery |
| 11 | `tool-11-local-api-edge-service-interface.html` | HTTP, MQTT, serial, WebSocket, local-first dashboard |
| 12 | `tool-12-manufacturing-qa-fixture-receipts.html` | PCBA tests, commissioning, supplier acceptance |
| 13 | `tool-13-enclosure-environmental-dfm.html` | 3D print, injection moulding, guards, weatherproofing |
| 14 | `tool-14-compliance-safety-risk-ledger.html` | Product safety, India compliance, blocked claims, waivers |

Each HTML tool should contain: tool purpose, project applicability cards, production-stage map, checklist, pass/fail gates, risk table, example wiring/logic pattern where applicable, and JSON/export-ready schema for LogicHub/GN8R use.
