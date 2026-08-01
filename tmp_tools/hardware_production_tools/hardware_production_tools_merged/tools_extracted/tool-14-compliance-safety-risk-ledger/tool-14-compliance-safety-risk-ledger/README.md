# Tool 14 — Compliance / Safety Risk Ledger

Final tool in the universal hardware production stack.

## Purpose
Create a project-independent ledger for hazards, standards, blocked claims, mitigation evidence, waiver decisions, and release gates.

## Use when
- A project involves mains power, batteries, motors, heaters, RF, cameras, medical/lab claims, robots, drones, EV charging, or industrial machinery.
- A prototype is being moved toward a kit, supplier review, public demo, customer deployment, or manufacturing release.
- A claim could imply safety, certification, medical/diagnostic capability, RF permission, autonomous operation, or field readiness.

## Included files
- `tool-14-compliance-safety-risk-ledger.html` — standalone dashboard/tool.
- `project_mapping.csv` — project applicability across the 14 created bundles.
- `risk_taxonomy.csv` — reusable risk classes.
- `safety_risk_ledger.schema.json` — export-ready JSON schema.
- `file_hashes.csv` — SHA-256 hashes for this package.

## Next state
All 14 individual hardware production tools are now complete. Next recommended step: generate a master ZIP/dashboard that links Tools 01–14 and the 14 research bundles.
