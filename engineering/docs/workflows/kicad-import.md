# KiCad Import Workflow

## Overview

The KiCad import workflow takes a KiCad 7 project directory, validates its structure, extracts semantic engineering objects, generates evidence artifacts, and stores everything in the persistence layer.

## Steps

1. **Project inspection** — `inspectProject(dir)` locates the `.kicad_pro` file and resolves sibling `.kicad_sch` / `.kicad_pcb` files. Throws `LH_KICAD_PROJECT_INVALID` if the directory structure is invalid.

2. **File validation** — `validateProjectFiles(files)` parse-checks each file (JSON for `.kicad_pro`, S-expression structure for schematic/PCB). Returns diagnostics without throwing, so a full validation report can be assembled.

3. **Object extraction** — Three extractors run against the parsed files:
   - `extractSchematicObjects` — produces `schematic_sheet` + `component` objects from `.kicad_sch`
   - `extractPcbObjects` — produces `pcb`, `layer`, `net`, `footprint`, `pad`, `track`, `via`, `zone`, `board_outline` objects from `.kicad_pcb`
   - `extractBom` — groups schematic components by (value, footprint) into `bom_item` objects

4. **Hashing** — Each object gets:
   - `contentHash` — SHA-256 of canonical JSON (properties + geometry)
   - `semanticHash` — SHA-256 of canonical JSON (properties only, no geometry)
   - Object ID derived from `sha256(revisionId/semanticKey)`

5. **Persistence** — Objects are stored via `EngineeringObjectRepository`. Snapshot hashes are computed and set on the revision record.

6. **Evidence generation** (when kicad-cli is available):
   - Schematic SVG render via `kicad-cli sch export svg`
   - PCB SVG render via `kicad-cli pcb export svg`
   - DRC report via `python3 pcbnew.WriteDRCReport` (KiCad 7) or `kicad-cli pcb drc` (KiCad 8+)
   - ERC — skipped on KiCad 7 (no headless ERC CLI)

7. **Validation results** — `ValidationResult` records are created for `kicad_import`, `drc`, and `erc` with honest statuses.

## Toolchain requirements

- **Parsing/extraction/BOM**: no external tools needed (pure TypeScript)
- **Renders**: KiCad 7+ with `kicad-cli`
- **DRC**: KiCad 7 with python3 pcbnew, or KiCad 8+ with `kicad-cli pcb drc`
- **ERC**: KiCad 8+ only (`kicad-cli sch erc`)

When the toolchain is unavailable, CLI operations return `status: 'skipped'` with an explanatory diagnostic — never fabricated results.

## Source isolation

All CLI operations copy the project to an isolated temp directory before executing. The source project directory is never modified.
