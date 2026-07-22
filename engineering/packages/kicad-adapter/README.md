# @logichub-engineering/kicad-adapter

Parses KiCad 7 project files (`.kicad_pro`, `.kicad_sch`, `.kicad_pcb`), extracts semantic engineering objects and BOM, generates schematic/PCB SVG renders, and runs DRC. Pinned to KiCad major version 7.

## Architecture

Two layers so the adapter works even without KiCad installed:

1. **Native TS parsing** — S-expression parser + extractors produce engineering objects and BOM directly from file content. No external tools needed.
2. **kicad-cli operations** — renders (SVG export) and DRC via `kicad-cli` / `python3 pcbnew`. Toolchain availability is detected at runtime; missing or wrong-version toolchain returns honest `skipped` status, never fabricated results.

## Usage

```typescript
import { KicadAdapter, inspectProject } from '@logichub-engineering/kicad-adapter';

const adapter = new KicadAdapter();
const files = await adapter.inspectProject('/path/to/kicad/project');
const validation = await adapter.validateProjectFiles(files);

const ctx = { projectId: 'proj-1', revisionId: 'rev-1', createdAt: new Date().toISOString() };
const schObjects = await adapter.extractSchematicObjects(ctx, files.schematicFile!);
const pcbObjects = await adapter.extractPcbObjects(ctx, files.pcbFile!);
const { items, objects } = await adapter.extractBom(ctx, files.schematicFile!);
```

## Extracted object types

- `schematic_sheet` — sheet-level metadata
- `component` — placed schematic symbols (non-power)
- `pcb` — board-level metadata
- `layer` — signal layers (F.Cu, B.Cu)
- `net` — named nets with pad counts
- `footprint` — placed footprints with pad details
- `pad` — individual pads with net assignments
- `track` — copper traces (segments and arcs)
- `via` — vias with layer spans
- `zone` — copper zones
- `board_outline` — Edge.Cuts geometry
- `bom_item` — grouped BOM entries

## Hashing

- `contentHash` = SHA-256 of canonical JSON (sorted keys) of properties + geometry
- `semanticHash` = same, minus geometry — a pure component move changes `contentHash` but not `semanticHash`

## Tests

91 new tests covering S-expression parsing, project inspection, schematic/PCB extraction, BOM grouping, hashing determinism, toolchain detection, kicad-cli integration (guarded), and the Phase 4 exit condition.
