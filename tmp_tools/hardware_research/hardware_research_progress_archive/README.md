# Hardware Research Progress Archive

Created: 2026-07-31T02:41:00+05:30

This clean archive preserves the progress summary, source inventory, project-to-tool mapping, remaining scope list, and the existing 14 ZIP bundles created so far.

## Contents

- `01_verified_zip_inventory.md` — detailed summary for all 14 created ZIP bundles.
- `02_universal_hardware_production_tools.md` — T01–T14 hardware production tool stack.
- `03_project_tool_mapping.md` — maps the 14 tools to the 14 ZIP projects.
- `04_remaining_scope.md` — selected-scope and optional projects still not bundled.
- `05_html_generation_plan.md` — exact one-by-one HTML tool generation order.
- `NEXT_STATE.md` — resume instructions for future continuation.
- `data/zip_inventory.csv` — machine-readable ZIP inventory.
- `data/universal_hardware_tools.csv` — machine-readable hardware tools.
- `data/project_tool_mapping.csv` — machine-readable project/tool mapping.
- `data/progress_manifest.json` — full JSON progress manifest.
- `data/bundle_file_hashes.csv` — SHA-256 hashes for included ZIP files.
- `schemas/progress_manifest.schema.json` — JSON schema for the progress manifest.
- `bundles/` — copies of the 14 ZIP bundles currently available in `/mnt/data`.

## Resume point

When the user says **next**, generate `tool-01-power-standardization-protection.html` first. Then continue one tool at a time through Tool 14.
