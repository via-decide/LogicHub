# Artifact Contract

## Purpose

An Artifact represents source or generated engineering evidence. Every generated file (render, report, diff, BOM export) is tracked as a content-addressed artifact with provenance metadata.

## Schema Version

`0.1.0`

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | ArtifactId | yes | Unique identifier |
| schemaVersion | string | no | Contract version (default `0.1.0`) |
| projectId | ProjectId | yes | Parent project |
| revisionId | RevisionId | yes | Revision this artifact belongs to |
| role | ArtifactRole | yes | Purpose of this artifact |
| filename | string | yes | Original filename |
| mediaType | string | yes | MIME type |
| byteSize | integer | yes | Size in bytes |
| sha256 | SHA-256 | yes | Content hash |
| storageKey | string | yes | Storage location key |
| sourcePaths | string[] | yes | Source files used to generate |
| generatedBy | string | no | Tool that generated this artifact |
| generatorVersion | string | no | Version of the generator |
| createdAt | ISODateTime | yes | Creation timestamp |
| provenance | Record | no | Additional provenance metadata |
| metadata | Record | no | Extensible key-value data |

## Enums

### ArtifactRole (14 values)

source, schematic_render, pcb_render, visual_diff, structural_diff, bom, bom_diff, erc_report, drc_report, constraint_report, validation_report, decision_export, revision_manifest, review_report

## Immutability

Artifacts are immutable after creation. Content is verified by SHA-256 hash.

## JSON Schema

`packages/contracts/generated/artifact.schema.json`
