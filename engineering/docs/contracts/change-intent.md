# ChangeIntent Contract

## Purpose

A ChangeIntent represents a proposed engineering modification. It captures what is being changed, what should be preserved, what should be optimized, and the approval policy, providing a structured record of intent before and during execution.

## Schema Version

`0.1.0`

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | ChangeIntentId | yes | | Unique identifier |
| schemaVersion | string | no | `0.1.0` | Contract version |
| projectId | ProjectId | yes | | Parent project |
| baseRevisionId | RevisionId | yes | | Starting revision |
| targetBranch | string | yes | | Branch for the change |
| title | string | yes | | Short description |
| requestText | string | no | | Natural-language request |
| changeType | string | yes | | Category of change |
| requestedOperations | unknown[] | yes | | Operations to perform |
| expectedObjectChanges | unknown[] | yes | | Expected object modifications |
| preserve | string[] | yes | | Objects/properties to preserve |
| optimize | string[] | yes | | Optimization targets |
| constraints | unknown[] | yes | | Added/modified constraints |
| approvalPolicy | ApprovalPolicy | yes | | Approval requirements |
| status | ChangeIntentStatus | no | `captured` | Lifecycle status |
| createdBy | string | yes | | Requesting actor |
| createdAt | ISODateTime | yes | | Creation timestamp |
| updatedAt | ISODateTime | no | | Last update timestamp |
| metadata | Record | no | | Extensible key-value data |

## State Machine

```
captured → planned → executing → generated → validating → validated → review → accepted
Any active state → failed | cancelled | rejected
```

Terminal states: `accepted`, `rejected`, `failed`, `cancelled`

## Validation Rules

- `approvalPolicy.autoMerge` must be `false` (per Section 1.6: human approval required)
- `approvalPolicy.requiredApprovals` must be >= 1

## JSON Schema

`packages/contracts/generated/change-intent.schema.json`
