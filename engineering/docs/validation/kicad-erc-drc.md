# KiCad ERC and DRC Validation

## Design Rule Check (DRC)

DRC verifies PCB layout against manufacturing and design constraints: clearances, track widths, via sizes, unconnected nets, and courtyard violations.

### Execution

The adapter detects available DRC backends at runtime:

| Backend | KiCad Version | Method |
|---------|--------------|--------|
| `python3 pcbnew` | 7.x | `pcbnew.LoadBoard()` + `pcbnew.WriteDRCReport()` |
| `kicad-cli pcb drc` | 8.x+ | `kicad-cli pcb drc --format json` |

When neither backend is available, DRC returns `{ status: 'skipped' }` with an explanatory diagnostic.

### Report parsing

- **JSON reports** (kicad-cli 8+): parsed into `FileDiagnostic[]` from `violations` / `errors` arrays
- **Text reports** (pcbnew): lines matching `[code]: message` are extracted as diagnostics

### Status inference

| Exit code | Diagnostics | Status |
|-----------|------------|--------|
| 0 | No errors/warnings | `pass` |
| 0 | Warnings only | `warning` |
| 0 | Errors present | `fail` |
| non-zero | Errors present | `fail` |
| non-zero | No errors | `error` |

## Electrical Rule Check (ERC)

ERC verifies schematic correctness: unconnected pins, conflicting pin types, missing power flags, and duplicate references.

### Execution

| Backend | KiCad Version | Method |
|---------|--------------|--------|
| `kicad-cli sch erc` | 8.x+ | `kicad-cli sch erc --format json` |

KiCad 7 does **not** provide a headless ERC command. On KiCad 7, ERC returns `{ status: 'skipped' }` with the diagnostic "KiCad 7 does not provide headless ERC — requires KiCad 8+".

## Source isolation

All checks run on an isolated copy of the project (via `mkdtemp` + recursive copy). The original project directory is never modified by any check operation. This is verified by hash-comparing the source directory before and after operations.

## Principles

- **No fabricated results**: when a check cannot run, it reports `skipped` with a reason — never `pass` or synthesized diagnostics (spec line 1344).
- **Version pinned**: the adapter is pinned to KiCad major version 7. Other versions trigger `LH_KICAD_VERSION_UNSUPPORTED`.
- **Diagnostics mapped to contract schema**: all DRC/ERC findings are mapped to `FileDiagnostic` with `severity`, `message`, `code`, and optional `location`.
