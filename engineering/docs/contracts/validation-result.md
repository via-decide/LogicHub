# ValidationResult Contract

## Purpose

A ValidationResult records one immutable validation execution. Validation records are never overwritten; new executions create new records. This provides a complete audit trail of all validation evidence.

## Schema Version

`0.1.0`

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | ValidationResultId | yes | Unique identifier |
| schemaVersion | string | no | Contract version (default `0.1.0`) |
| projectId | ProjectId | yes | Parent project |
| revisionId | RevisionId | yes | Revision validated |
| changeIntentId | ChangeIntentId | no | Related change intent |
| validator | string | yes | Validator name |
| validatorVersion | string | yes | Validator version |
| validationType | ValidationType | yes | Kind of validation |
| status | ValidationStatus | yes | Result status |
| startedAt | ISODateTime | yes | When validation started |
| completedAt | ISODateTime | no | When validation completed |
| durationMs | integer | no | Duration in milliseconds |
| diagnostics | Diagnostic[] | yes | Detailed findings |
| metrics | Record<string,number> | no | Numeric metrics |
| artifactIds | ArtifactId[] | yes | Generated report artifacts |
| environment | Record<string,string> | no | Execution environment |
| inputHash | SHA-256 | no | Hash of validation inputs |
| createdAt | ISODateTime | yes | Record creation timestamp |
| metadata | Record | no | Extensible key-value data |

## Enums

### ValidationType (9 values)

schema, repository_integrity, kicad_import, erc, drc, bom, constraint, artifact_integrity, merge_gate

### ValidationStatus (6 values)

pass, warning, fail, error, unknown, skipped

## Immutability

Validation records are immutable after creation.

## JSON Schema

`packages/contracts/generated/validation-result.schema.json`
