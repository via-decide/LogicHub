# Project Contract

## Purpose

A Project represents a hardware repository managed by LogicHub. It links a Git repository to the engineering collaboration platform and provides the organizational root for revisions, constraints, decisions, and pull requests.

## Schema Version

`0.1.0`

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | ProjectId (string) | yes | | Unique identifier |
| schemaVersion | string | no | `0.1.0` | Contract version |
| slug | string (a-z0-9-) | yes | | URL-safe identifier, 1-128 chars |
| name | string | yes | | Display name, 1-256 chars |
| description | string | no | | Free-text description |
| visibility | ProjectVisibility | yes | | Access level |
| repository | RepositoryInfo | yes | | Git repository details |
| defaultBranch | string | no | `main` | Default branch name |
| createdBy | string | yes | | Actor who created the project |
| createdAt | ISODateTime | yes | | Creation timestamp |
| updatedAt | ISODateTime | no | | Last update timestamp |
| status | ProjectStatus | no | `active` | Lifecycle status |
| metadata | Record | no | | Extensible key-value data |

## Enums

### ProjectStatus

| Value | Description |
|-------|-------------|
| active | Project is actively managed |
| archived | Project is read-only |
| suspended | Project is temporarily disabled |

### ProjectVisibility

| Value | Description |
|-------|-------------|
| public | Visible to everyone |
| private | Visible only to members |
| organization | Visible to organization members |

## Relationships

- Referenced by: Revision, EngineeringObject, Constraint, Decision, Artifact, ChangeIntent, ValidationResult, Module, EngineeringPullRequest
- References: none (root entity)

## JSON Schema

`packages/contracts/generated/project.schema.json`
