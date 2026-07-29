# Revision Contract

## Purpose

A Revision maps an immutable engineering snapshot to a Git commit. It captures the full engineering state at a point in time: object graph, constraints, decisions, BOM, artifacts, and validation results, all anchored to a real Git SHA.

## Schema Version

`0.1.0`

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | RevisionId | yes | | Unique identifier |
| schemaVersion | string | no | `0.1.0` | Contract version |
| projectId | ProjectId | yes | | Parent project |
| gitCommitSha | string (40 hex) | yes | | Git commit SHA |
| branchName | string | yes | | Branch this revision belongs to |
| parentRevisionIds | RevisionId[] | yes | | Parent revision(s) |
| author | string | yes | | Commit author |
| message | string | yes | | Commit message |
| createdAt | ISODateTime | yes | | Creation timestamp |
| snapshotHash | SHA-256 | no | | Overall snapshot hash |
| engineeringObjectSnapshotHash | SHA-256 | no | | Object graph hash |
| constraintSnapshotHash | SHA-256 | no | | Constraint set hash |
| decisionSnapshotHash | SHA-256 | no | | Decision set hash |
| bomSnapshotHash | SHA-256 | no | | BOM snapshot hash |
| artifactManifestHash | SHA-256 | no | | Artifact manifest hash |
| toolchain | Record<string,string> | yes | | Tool versions used |
| status | RevisionStatus | no | `draft` | Lifecycle status |
| metadata | Record | no | | Extensible key-value data |

## State Machine

```
draft → imported → validating → validated → review → merged
Any pre-merge state → failed | rejected
```

Terminal states: `merged`, `failed`, `rejected`

## Immutability

After status reaches `merged`, all fields are immutable. New validation executions create new ValidationResult records, not updates to the revision.

## Relationships

- References: Project
- Referenced by: EngineeringObject, Constraint, Decision, Artifact, ChangeIntent, ValidationResult, EngineeringPullRequest

## JSON Schema

`packages/contracts/generated/revision.schema.json`
