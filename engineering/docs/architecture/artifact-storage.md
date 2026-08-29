# Artifact Storage

## Why content-addressed

Architectural principle 1.4 requires every generated artifact to be stored by content hash rather than mutable filename, carrying SHA-256, media type, byte size, generator identity, source revision, and creation timestamp. This makes an artifact's identity a property of its bytes: two callers producing byte-identical output (e.g. re-running ERC on the same commit) converge on the same storage key instead of creating a duplicate, and any later mismatch between stored content and its claimed hash is a detectable tamper/corruption event, not a silent drift.

## `ArtifactStore` interface

```ts
interface ArtifactStore {
  put(content: Buffer, metadata): Promise<{ sha256, byteSize, alreadyExisted }>;
  get(sha256: string): Promise<Buffer | null>;
  getMetadata(sha256: string): Promise<ArtifactMetadata | null>;
  verify(sha256: string): Promise<boolean>;   // throws LH_ARTIFACT_HASH_MISMATCH on corruption
  exists(sha256: string): Promise<boolean>;
}
```

`packages/artifact-store/src/local-artifact-store.ts`'s `LocalArtifactStore` is the only implementation: a filesystem tree under a configured root, sharded by the first two hex characters of the hash (`<root>/<sha[0:2]>/<sha>`), with a sibling `<sha>.meta.json` per object. The interface is deliberately storage-agnostic — a future S3/GCS-backed implementation is a drop-in replacement for `LocalArtifactStore` with no change to any caller.

## Write path

`put()` computes the SHA-256 of the given buffer itself — callers never supply a hash, so a `put` can never lie about its own content's identity. If content already exists at that hash, it's left untouched (`alreadyExisted: true`) unless the new bytes actually differ from what's stored, which throws `LH_ARTIFACT_HASH_MISMATCH` immediately rather than silently overwriting (a same-hash-different-content collision would only happen from a SHA-256 collision or a caller bug, but the store never trusts that it can't).

## Verification is not optional at read time

Two call sites in `domain` never trust a stored artifact's hash without checking it:

- `RevisionComparisonService.findCachedManifest` calls `ArtifactStore.verify()` on a cached `revision_manifest` artifact before parsing and using it; a failed or missing verification falls back to a full fingerprint rebuild rather than serving unverified content (`docs/workflows/revision-diff.md`).
- `MergeService.buildGateInput`'s `allArtifactsVerify` re-verifies every `Artifact` on the head revision before merge gate 5 (`ARTIFACT_HASHES_VALID`) can pass (`docs/validation/merge-gates.md`).

`verify()` itself reads the stored bytes, recomputes the hash, and throws `LH_ARTIFACT_HASH_MISMATCH` if it doesn't match the requested key — a mismatch is a hard error, not a boolean `false`, precisely because on-disk content silently diverging from its own claimed identity is the one failure mode this design exists to make impossible to miss.

## What's stored today

| Role | Written by | Contents |
|---|---|---|
| `erc_report` / `drc_report` | `ImportService` | Raw ERC/DRC tool output, when the toolchain produced a report and kicad-cli was available. |
| `revision_manifest` | `RevisionComparisonService` | The JSON-serialized `FingerprintResult` from `repository-engine.buildFingerprint`, cached per revision id (a plain hash-verified artifact, not a separate cache subsystem — see `docs/workflows/revision-diff.md`). |

`Artifact.role` is a free-form string in the contract (`docs/contracts/artifact.md`), so future roles (e.g. rendered schematic/PCB SVGs, which `VisualDiffService` currently returns inline as base64 rather than persisting as artifacts — see `docs/workflows/revision-diff.md`) can be added without a schema change.

## Retrieval through the API

`GET /artifacts/:artifactId` returns the `Artifact` metadata row by default; `?content=1` streams the actual bytes from `ArtifactStore.get()` with the artifact's real `mediaType` and `filename` set as response headers, or a `404 LH_ARTIFACT_NOT_FOUND` if the metadata row exists but the content itself is missing from the store (a real, distinct failure mode from "artifact doesn't exist at all").
