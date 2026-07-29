# ADR-0002: KiCad version strategy — accept 7 and 8, target 8 for controlled toolchain

Date: 2026-07-22
Status: Accepted

## Context

The kicad-adapter is pinned to `PINNED_KICAD_MAJOR = 7`. KiCad 7 provides schematic/PCB rendering
and DRC via python3 pcbnew, but headless ERC requires KiCad 8+. The adapter already handles this
gracefully: `ercCli` capability is false on KiCad 7, and `runErc()` returns `status: 'skipped'`.

The plan requires merge-gated workflows where ERC results contribute to merge eligibility. Skipped
ERC must never be treated as pass — but a permanently skipped ERC means the platform can never
produce complete validation evidence for the electrical domain.

## Decision

1. Expand the adapter to accept KiCad major versions 7 and 8 (change `PINNED_KICAD_MAJOR` to a
   supported range `SUPPORTED_KICAD_VERSIONS = [7, 8]`).
2. Capability detection remains as-is: KiCad 7 gets rendering + DRC (python), KiCad 8 gets
   rendering + DRC (CLI) + ERC (CLI).
3. The controlled toolchain for Docker and CI targets KiCad 8.
4. When only KiCad 7 is available, the system operates in **preview mode**: all workflows function,
   but merge-gate evaluation treats skipped ERC as `requires_validation` (not pass, not unknown).
5. `assertSupportedVersion()` accepts any version in the supported range.

## Consequences

- Development environments with KiCad 7 can run the full workflow except headless ERC.
- The Docker image (Phase 8) pins KiCad 8 for complete toolchain coverage.
- No ERC result is ever fabricated or silently promoted to pass.
- The review engine must treat `skipped` ERC distinctly from `pass` when evaluating merge gates.
- Fixture tests run against whichever KiCad version is installed; CI pins KiCad 8.

## Alternatives considered

- Hard-require KiCad 8 immediately — rejected: blocks development on environments without KiCad 8
  installed; the S-expression parser and rendering already work on KiCad 7.
- Keep the single-version pin at 7 — rejected: permanently blocks headless ERC, which is required
  for complete merge-gate validation.
