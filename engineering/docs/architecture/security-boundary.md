# Security Boundary

Master spec section 18 lists 14 minimum security controls. This document states plainly, item by item, which are real and where the code lives — and which are not implemented, rather than letting the list's presence in the spec imply they all are. This matches the "never fabricate a result" convention applied to security posture, not just to engineering data.

## Implemented

| Control | Where | Detail |
|---|---|---|
| Path traversal prevention | `git-adapter/src/validation.ts` (`assertSafeRepositoryPath`) | Rejects non-absolute paths, null bytes, and any path that doesn't equal its own `path.resolve()`-normalized form (i.e. contains `..` or `.` segments). Also `assertValidBranchName`/`assertValidRef`, rejecting `..`, `//`, leading `-`/`/`, `@{`, and `.lock`-suffixed ref names. |
| Safe subprocess argument handling | `git-adapter/src/git-executor.ts`, `kicad-adapter/src/kicad-executor.ts` | Both use `child_process.execFile` with an argument array and no shell — no string interpolation into a shell command line is possible. `kicad-executor` additionally rejects any argument containing a null byte before spawning. |
| Tool execution timeouts | `kicad-executor.ts` (`DEFAULT_TIMEOUT_MS = 120_000`, `execFile`'s own `timeout` option), `git-executor.ts` | A killed-on-timeout process raises `LH_TIMEOUT` rather than hanging the caller indefinitely. |
| KiCad process resource limits | `kicad-executor.ts` (`maxBuffer: 64 MiB`) | Bounds captured stdout/stderr per invocation; does not bound the external process's own memory/CPU (see gaps below). |
| SHA-256 verification | `artifact-store` (`docs/architecture/artifact-storage.md`) | Every artifact read through `MergeService`'s and `RevisionComparisonService`'s trust paths is hash-verified before use; a mismatch raises `LH_ARTIFACT_HASH_MISMATCH` rather than silently serving unverified content. |
| Read-only import stage | `git-adapter`'s `restoreWorkingTree` + `kicad-adapter`'s `mkdtemp`-based isolation | `ImportService`, `VisualDiffService`, and kicad-adapter's own CLI operations all materialize the commit's tree into a fresh temp directory rather than operating on the caller's actual checkout — the source repository is never written to during import. |
| Isolated temporary workspaces | `ImportService.importRevision`, `VisualDiffService.renderRevision`, `kicad-adapter/src/operations.ts` | Each uses `mkdtemp(join(tmpdir(), 'logichub-...-'))` per operation — never a shared or predictable path. |
| Cleanup after tool execution | Same call sites, in `finally` blocks | `git.removeWorkingTree(workDir).catch(() => undefined)` followed by `rm(workDir, { recursive: true, force: true }).catch(() => undefined)` — cleanup is attempted even when the operation itself failed, and a cleanup failure never masks or replaces the operation's own error. |
| Structured audit events | `kicad-executor.ts`'s `ToolCommandAudit` (`onAudit` callback, truncated to 64 KiB per stream, full command/args/exitCode/duration recorded); `domain`'s `DomainEventSink` (`docs/architecture/domain-model.md`) | Two separate audit surfaces: per-subprocess-invocation (kicad-adapter) and per-domain-lifecycle-event (domain). |
| Do not execute arbitrary project scripts during import | `ImportService`'s pipeline | Only ever invokes `kicad-cli`/`python3 pcbnew` with fixed, code-constructed argument lists against the imported files; nothing in the import path reads or executes a script from within the imported project itself. |

## Not implemented — real gaps

| Control | Status |
|---|---|
| Repository path allowlisting | `assertSafeRepositoryPath` validates that a given path is *well-formed* (absolute, normalized, no traversal) but does not check it against a configured allowlist of permitted roots — any absolute, normalized path on the host filesystem is accepted. There is no `LOGICHUB_ALLOWED_REPO_ROOTS`-style configuration anywhere in `apps/api` or `domain`. |
| Archive extraction protection | Not applicable today in the sense that there is no archive-extraction code path at all — projects are imported from an already-checked-out git working tree, never from an uploaded `.zip`/`.tar`. If a future upload-based import path is added, this control does not yet exist and must be built then, not assumed already covered. |
| File-size limits | No per-file size check anywhere in `kicad-adapter`'s parsers or `ImportService`. A pathologically large `.kicad_sch`/`.kicad_pcb` is read and parsed in full. |
| Project-size limits | No check on the total number of files or objects a KiCad project may contain before import proceeds. |
| MIME-type verification | Extraction is driven entirely by file extension (`.kicad_pro`/`.kicad_sch`/`.kicad_pcb`) and, for the parsers themselves, by whether the content parses as valid JSON/S-expression — there is no independent content-sniffing MIME check before that parse is attempted. |
| Disable or bypass repository hooks | `git-adapter` never sets `core.hooksPath` or passes `--no-verify`/equivalent to the git operations it runs — hooks configured in a repository would execute with whatever the ambient git configuration allows. This is a real, currently-unaddressed gap relative to "Do not automatically trust Git hooks. Disable or bypass repository hooks in controlled execution environments." |

## What this means in practice

None of the six unimplemented controls have been exercised by an actual attack path found during Phases 5–8's work — the sandbox this was built in has no untrusted multi-tenant input, no archive upload, and a single operator. But they are real gaps against the master spec's stated minimum, not oversights papered over in this document: a deployment that accepts KiCad projects from untrusted sources should not treat this system as hardened against a malicious or malformed project until repository allowlisting, size limits, MIME verification, and hook suppression are added.
