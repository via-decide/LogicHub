# EngineeringPullRequest Contract

## Purpose

An EngineeringPullRequest turns a hardware change into a reviewable, merge-gated engineering proposal. It aggregates diffs, validation results, constraint evaluations, and reviews into a single decision point.

## Schema Version

`0.1.0`

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | EngineeringPullRequestId | yes | | Unique identifier |
| schemaVersion | string | no | `0.1.0` | Contract version |
| projectId | ProjectId | yes | | Parent project |
| number | integer (positive) | yes | | PR number within project |
| title | string | yes | | PR title |
| description | string | no | | PR description |
| baseBranch | string | yes | | Target branch |
| baseRevisionId | RevisionId | yes | | Base revision |
| headBranch | string | yes | | Source branch |
| headRevisionId | RevisionId | yes | | Head revision |
| changeIntentId | ChangeIntentId | no | | Related change intent |
| author | string | yes | | PR author |
| status | PRStatus | no | `draft` | PR lifecycle status |
| reviewState | PRStatus | no | | Current review state |
| requiredApprovals | integer | no | `1` | Min approvals needed |
| approvals | ReviewRecord[] | yes | | Approval records |
| changeRequests | ReviewRecord[] | yes | | Change request records |
| diffSummary | DiffSummary | no | | File/object change counts |
| validationSummary | ValidationSummary | no | | Validation result counts |
| constraintSummary | ConstraintSummary | no | | Constraint result counts |
| mergeEligibility | MergeEligibility | no | | Merge readiness + blockers |
| createdAt | ISODateTime | yes | | Creation timestamp |
| updatedAt | ISODateTime | no | | Last update timestamp |
| mergedAt | ISODateTime | no | | Merge timestamp |
| mergedRevisionId | RevisionId | no | | Resulting merged revision |
| metadata | Record | no | | Extensible key-value data |

## State Machine

```
draft → open → changes_requested ↔ open → approved → merged
draft/open/changes_requested/approved → closed | rejected
```

Terminal states: `merged`, `closed`, `rejected`

## Review Decisions

comment, approve, request_changes

## Merge Eligibility

The `mergeEligibility` field contains:
- `eligible: boolean` — whether merge is allowed
- `blockers: MergeBlocker[]` — list of blocking conditions with code and message

Merge eligibility must be recalculated immediately before merge (Section 11).

## JSON Schema

`packages/contracts/generated/engineering-pull-request.schema.json`
