# Decision Contract

## Purpose

A Decision preserves engineering rationale. It records why a particular alternative was chosen, what tradeoffs were considered, and links to supporting evidence and validation results.

## Schema Version

`0.1.0`

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | DecisionId | yes | | Unique identifier |
| schemaVersion | string | no | `0.1.0` | Contract version |
| projectId | ProjectId | yes | | Parent project |
| revisionId | RevisionId | yes | | Revision scope |
| changeIntentId | ChangeIntentId | no | | Related change intent |
| question | string | yes | | The question being decided |
| context | string | no | | Background context |
| alternatives | DecisionAlternative[] | yes | | Options considered |
| selectedAlternative | string | no | | ID of chosen alternative |
| rationale | string | no | | Why this choice was made |
| tradeoffs | string | no | | Known tradeoffs |
| constraintsConsidered | string[] | yes | | Constraint IDs considered |
| evidenceArtifactIds | ArtifactId[] | yes | | Supporting artifacts |
| validationResultIds | ValidationResultId[] | yes | | Supporting validations |
| confidence | DecisionConfidence | no | | Confidence level |
| status | DecisionStatus | no | `proposed` | Lifecycle status |
| createdBy | string | yes | | Actor who created it |
| createdAt | ISODateTime | yes | | Creation timestamp |
| supersedesDecisionId | DecisionId | no | | Previous decision this replaces |
| metadata | Record | no | | Extensible key-value data |

## Enums

### DecisionStatus

proposed, accepted, rejected, superseded

### DecisionConfidence

low, medium, high

## JSON Schema

`packages/contracts/generated/decision.schema.json`
