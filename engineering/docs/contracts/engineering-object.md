# EngineeringObject Contract

## Purpose

An EngineeringObject is a semantic entity extracted from engineering files. It provides stable identity for components, nets, footprints, and other design elements across revisions, enabling meaningful diffs and constraint targeting.

## Schema Version

`0.1.0`

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | EngineeringObjectId | yes | Unique identifier |
| schemaVersion | string | no | Contract version (default `0.1.0`) |
| projectId | ProjectId | yes | Parent project |
| revisionId | RevisionId | yes | Revision this snapshot belongs to |
| objectType | EngineeringObjectType | yes | Kind of engineering entity |
| sourcePath | string | yes | Source file path |
| sourceObjectId | string | no | Original ID in source format |
| name | string | yes | Display name |
| semanticKey | string | yes | Stable identity across revisions |
| properties | Record | yes | Type-specific properties |
| relationships | ObjectRelationship[] | yes | Graph edges to other objects |
| geometry | Record | no | Position/size data |
| contentHash | SHA-256 | yes | Hash of full content |
| semanticHash | SHA-256 | yes | Hash of semantic properties only |
| createdAt | ISODateTime | yes | Creation timestamp |
| metadata | Record | no | Extensible key-value data |

## Enums

### EngineeringObjectType (20 values)

project, schematic_sheet, symbol, component, net, pin, interface, pcb, footprint, pad, track, via, zone, layer, board_outline, bom_item, test_point, document, firmware_interface, module_instance

## Relationships

- References: Project, Revision
- Referenced by: Constraint (targetObjectIds)
- Internal: ObjectRelationship edges using RelationshipType

## JSON Schema

`packages/contracts/generated/engineering-object.schema.json`
