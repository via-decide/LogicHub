# Module Contract

## Purpose

A Module represents a reusable versioned hardware subsystem. The module registry is implemented at the contract and persistence level; a public marketplace is not required in v0.1.

## Schema Version

`0.1.0`

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | ModuleId | yes | | Unique identifier |
| schemaVersion | string | no | `0.1.0` | Contract version |
| namespace | string | yes | | Module namespace |
| name | string | yes | | Module name |
| version | string | yes | | Semantic version |
| description | string | no | | Description |
| sourceProjectId | ProjectId | no | | Source project |
| sourceRevisionId | RevisionId | no | | Source revision |
| interfaces | unknown[] | yes | | Module interfaces |
| requirements | string[] | yes | | Requirements list |
| constraints | unknown[] | yes | | Module constraints |
| dependencies | ModuleDependency[] | yes | | Module dependencies |
| artifactIds | ArtifactId[] | yes | | Associated artifacts |
| bomItemIds | string[] | yes | | BOM item references |
| verificationStatus | VerificationStatus | no | `unverified` | Verification level |
| license | string | no | | License identifier |
| maintainers | string[] | yes | | Maintainer list |
| createdAt | ISODateTime | yes | | Creation timestamp |
| publishedAt | ISODateTime | no | | Publication timestamp |
| metadata | Record | no | | Extensible key-value data |

## Enums

### VerificationStatus (6 values)

unverified, community, reviewed, validated, deprecated, revoked

## JSON Schema

`packages/contracts/generated/module.schema.json`
