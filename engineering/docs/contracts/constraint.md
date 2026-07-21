# Constraint Contract

## Purpose

A Constraint represents a machine-evaluable engineering requirement. Constraints are typed rules that can be automatically checked against the engineering graph to determine if a design meets its requirements.

## Schema Version

`0.1.0`

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | ConstraintId | yes | | Unique identifier |
| schemaVersion | string | no | `0.1.0` | Contract version |
| projectId | ProjectId | yes | | Parent project |
| revisionId | RevisionId | yes | | Revision scope |
| name | string | yes | | Human-readable name |
| description | string | no | | Detailed description |
| category | ConstraintCategory | yes | | Engineering domain |
| severity | ConstraintSeverity | yes | | Impact level |
| scope | string | yes | | Evaluation scope (e.g. "revision", "object") |
| targetObjectIds | EngineeringObjectId[] | yes | | Objects this constraint applies to |
| expression | unknown | no | | Evaluable expression (refined in Phase 5) |
| unit | string | no | | Unit of measurement |
| expected | unknown | no | | Expected value |
| source | string | no | | Origin of the constraint |
| status | string | no | `active` | Constraint status |
| evaluation | ConstraintEvaluation | no | `unknown` | Current evaluation result |
| createdBy | string | yes | | Actor who created it |
| createdAt | ISODateTime | yes | | Creation timestamp |
| updatedAt | ISODateTime | no | | Last update timestamp |
| metadata | Record | no | | Extensible key-value data |

## Enums

### ConstraintCategory (9 values)

electrical, mechanical, thermal, manufacturing, supply_chain, cost, reliability, interface, project_policy

### ConstraintSeverity

| Value | Description |
|-------|-------------|
| info | Informational, does not block |
| warning | Advisory, may indicate issues |
| blocking | Must pass for merge eligibility |

### ConstraintEvaluation

pass, warning, violation, unknown, requires_validation, error

## JSON Schema

`packages/contracts/generated/constraint.schema.json`
