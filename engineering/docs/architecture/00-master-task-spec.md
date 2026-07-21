# LogicHub v0.1 Engineering Repository Contract + KiCad Collaboration Foundation

Repository: "via-decide/logichub"
Repository URL: "https://github.com/via-decide/logichub.git"
Mode: "logichub-v0.1-engineering-repository-contract"
Tier: T5
Estimated effort: 1200+ minutes
Version: 1.0
Primary implementation target: Claude Code
Scope status: Frozen for v0.1

Note: this document is preserved verbatim as received. It is scoped to the `engineering/`
subtree per ADR-0001 (`../decisions/adr-0001-engineering-platform-integration.md`) — the root
LogicHub app builder and its existing `apps/`/`packages/` are a separate, unrelated product and
are out of scope for everything below.

---

MASTER OBJECTIVE

Define and implement the LogicHub v0.1 Engineering Repository Contract and a working collaboration platform for KiCad hardware projects.

LogicHub v0.1 must provide:

- Git-backed hardware projects
- Branches and immutable revisions
- Semantic engineering-object extraction
- Engineering pull requests
- Review and approval workflows
- Schematic visual diffs
- PCB visual diffs
- Structural schematic and PCB diffs
- BOM change reports
- Typed engineering constraints
- Constraint evaluation
- Structured design decisions
- Validation results
- KiCad ERC and DRC execution
- Artifact provenance and content hashing
- A complete KiCad import → diff → validation → engineering PR → review → merge workflow

The implementation must create a reliable engineering state-management layer.

Do not build a general autonomous prompt-to-PCB generator in this task.

---

OPERATING PIPELINE

SOURCE

Inputs may include:

- Git repositories
- KiCad project files
- ".kicad_pro"
- ".kicad_sch"
- ".kicad_pcb"
- KiCad libraries
- BOM CSV files
- Project documentation
- Constraint definitions
- Decision records
- Validation configuration
- Generated SVG, PNG, JSON, CSV, and report artifacts

The canonical source of file history must remain Git.

LogicHub must add semantic engineering state, validation evidence, artifact provenance, decisions, constraints, and review workflows around Git commits.

↓

ACCESS / ENTRY

Users must be able to:

1. Import an existing KiCad Git repository.
2. Create a LogicHub project.
3. Register a baseline revision.
4. Create a branch.
5. commit a modified KiCad project.
6. Import the new revision.
7. Compare two revisions.
8. Create an engineering pull request.
9. Review schematic, PCB, BOM, constraint, decision, and validation changes.
10. Approve, request changes, reject, or merge the pull request.

Provide both:

- API access
- Browser-based project and pull-request views

A CLI may also be provided for development, testing, and automation.

↓

INTENT CAPTURE

Every proposed engineering change must be represented as a typed "ChangeIntent".

A "ChangeIntent" must identify:

- Project
- Base revision
- Target branch
- Requesting actor
- Requested change
- Engineering objects expected to change
- Objects or properties that must be preserved
- Optimization targets
- Added or modified constraints
- Approval policy
- Current lifecycle state

Natural-language requests may be stored as context, but they must not directly authorize arbitrary file modifications.

↓

STATE / LOGIC ENGINE

The system must maintain:

- Git state
- Project state
- Revision state
- Engineering-object graph
- Constraint state
- Decision history
- Validation state
- Artifact manifest
- Pull-request state
- Review state
- Merge eligibility

Deterministic parsers and validators are authoritative.

AI-generated explanations or recommendations must never replace ERC, DRC, schema validation, content hashing, constraint evaluation, or human approval.

↓

ACTIONS

The platform must support:

- Import
- Normalize
- Parse
- Hash
- Snapshot
- Branch
- Commit
- Compare
- Render
- Validate
- Review
- Approve
- Request changes
- Reject
- Merge
- Restore
- Audit

↓

OUTPUT / METRICS

Every engineering pull request must produce:

- Intent diff
- Git file diff
- Engineering-object diff
- Schematic visual diff
- PCB visual diff
- BOM delta
- Constraint evaluation report
- Decision-history delta
- ERC result
- DRC result
- Artifact provenance report
- Review state
- Merge eligibility
- Final immutable revision after merge

---

1. ARCHITECTURAL PRINCIPLES

1.1 Git remains the file-history authority

Do not implement a replacement Git engine.

Each LogicHub project must be backed by a Git repository.

A LogicHub revision must reference a real Git commit SHA.

LogicHub must store semantic engineering information keyed to that SHA.

1.2 Engineering state is larger than a Git tree

A revision consists of:

Git commit
+
Engineering object snapshot
+
Constraint set
+
Decision records
+
Artifact manifest
+
Validation results
+
BOM snapshot
+
Tool-version metadata
+
Content hashes

1.3 Revisions are immutable

After a revision is finalized:

- Its Git SHA cannot change.
- Its engineering snapshot cannot change.
- Its artifacts cannot be replaced.
- Its validation results cannot be overwritten.
- New validation executions must create new records.
- Corrections must create a new revision.

1.4 Generated artifacts must be content-addressed

Every generated artifact must include:

- SHA-256 hash
- Media type
- Byte size
- Generator name
- Generator version
- Source revision
- Source files
- Creation timestamp
- Storage location
- Provenance metadata

Store artifacts by content hash rather than mutable filename alone.

1.5 Unknown is not pass

Constraint and validation states must distinguish:

- "pass"
- "warning"
- "fail"
- "error"
- "unknown"
- "skipped"
- "requires_validation"

Never silently treat missing evidence as success.

1.6 Human approval remains required

LogicHub v0.1 must not autonomously merge engineering changes.

At least one explicit approval must be required.

Blocking validation failures or blocking constraint violations must prevent merging.

---

2. DEFAULT TECHNOLOGY STACK

Preserve an existing repository stack if one already exists and is coherent.

If the repository is empty, use:

- TypeScript
- Node.js 22 or later
- pnpm workspaces
- Fastify or an equivalent typed HTTP framework
- React
- Vite
- SQLite for local v0.1 persistence
- Repository interfaces that allow PostgreSQL later
- Zod for runtime validation
- Generated JSON Schema for portable contracts
- Vitest for unit and integration tests
- Playwright for browser workflow tests
- Docker Compose for local services
- A pinned KiCad CLI container or reproducible KiCad execution environment
- Local content-addressed artifact storage for development

Do not add Kubernetes, distributed queues, event streaming, microservice deployment, or cloud-specific infrastructure in v0.1.

Keep domain boundaries clear while running the application as a modular monolith.

---

3. REPOSITORY STRUCTURE

Use or evolve toward:

logichub/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── contracts/
│   ├── domain/
│   ├── persistence/
│   ├── git-adapter/
│   ├── kicad-adapter/
│   ├── engineering-graph/
│   ├── diff-engine/
│   ├── validation-engine/
│   ├── artifact-store/
│   ├── review-engine/
│   └── shared/
├── fixtures/
│   └── kicad/
├── scripts/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   └── e2e/
├── docs/
│   ├── architecture/
│   ├── contracts/
│   ├── workflows/
│   ├── decisions/
│   ├── validation/
│   └── operations/
├── docker/
├── examples/
├── pnpm-workspace.yaml
├── package.json
└── README.md

Do not split the application into networked microservices in this version.

Packages must enforce internal architecture boundaries.

---

4. REQUIRED DOMAIN CONTRACTS

Implement each contract in:

- TypeScript types
- Runtime validation schemas
- JSON Schema
- Persistence model
- Serialization tests
- Versioned contract documentation

Every contract must include a "schemaVersion".

---

4.1 Project

A "Project" represents a hardware repository managed by LogicHub.

Required fields:

id:
schemaVersion:
slug:
name:
description:
visibility:
repository:
  provider:
  remoteUrl:
  localPath:
  defaultBranch:
defaultBranch:
createdBy:
createdAt:
updatedAt:
status:
metadata:

Required status values:

- "active"
- "archived"
- "suspended"

Required visibility values:

- "public"
- "private"
- "organization"

---

4.2 Revision

A "Revision" maps an immutable engineering snapshot to a Git commit.

Required fields:

id:
schemaVersion:
projectId:
gitCommitSha:
branchName:
parentRevisionIds:
author:
message:
createdAt:
snapshotHash:
engineeringObjectSnapshotHash:
constraintSnapshotHash:
decisionSnapshotHash:
bomSnapshotHash:
artifactManifestHash:
toolchain:
status:
metadata:

Required status values:

- "draft"
- "imported"
- "validating"
- "validated"
- "review"
- "merged"
- "rejected"
- "failed"

A revision must not be marked "validated" without validation records.

---

4.3 EngineeringObject

An "EngineeringObject" is a semantic entity extracted from engineering files.

Required object types:

- "project"
- "schematic_sheet"
- "symbol"
- "component"
- "net"
- "pin"
- "interface"
- "pcb"
- "footprint"
- "pad"
- "track"
- "via"
- "zone"
- "layer"
- "board_outline"
- "bom_item"
- "test_point"
- "document"
- "firmware_interface"
- "module_instance"

Required fields:

id:
schemaVersion:
projectId:
revisionId:
objectType:
sourcePath:
sourceObjectId:
name:
semanticKey:
properties:
relationships:
geometry:
contentHash:
semanticHash:
createdAt:
metadata:

"semanticKey" must remain stable across revisions when the logical object remains the same.

Do not rely only on source-file line numbers.

---

4.4 Constraint

A "Constraint" represents a machine-evaluable engineering requirement.

Required categories:

- "electrical"
- "mechanical"
- "thermal"
- "manufacturing"
- "supply_chain"
- "cost"
- "reliability"
- "interface"
- "project_policy"

Required fields:

id:
schemaVersion:
projectId:
revisionId:
name:
description:
category:
severity:
scope:
targetObjectIds:
expression:
unit:
expected:
source:
status:
evaluation:
createdBy:
createdAt:
updatedAt:
metadata:

Required severity values:

- "info"
- "warning"
- "blocking"

Required evaluation statuses:

- "pass"
- "warning"
- "violation"
- "unknown"
- "requires_validation"
- "error"

The first implementation may support a constrained expression language.

Do not execute arbitrary JavaScript or shell expressions.

---

4.5 Decision

A "Decision" preserves engineering rationale.

Required fields:

id:
schemaVersion:
projectId:
revisionId:
changeIntentId:
question:
context:
alternatives:
selectedAlternative:
rationale:
tradeoffs:
constraintsConsidered:
evidenceArtifactIds:
validationResultIds:
confidence:
status:
createdBy:
createdAt:
supersedesDecisionId:
metadata:

Required status values:

- "proposed"
- "accepted"
- "rejected"
- "superseded"

A material engineering change must be able to reference at least one decision.

---

4.6 Artifact

An "Artifact" represents source or generated engineering evidence.

Required fields:

id:
schemaVersion:
projectId:
revisionId:
role:
filename:
mediaType:
byteSize:
sha256:
storageKey:
sourcePaths:
generatedBy:
generatorVersion:
createdAt:
provenance:
metadata:

Required artifact roles:

- "source"
- "schematic_render"
- "pcb_render"
- "visual_diff"
- "structural_diff"
- "bom"
- "bom_diff"
- "erc_report"
- "drc_report"
- "constraint_report"
- "validation_report"
- "decision_export"
- "revision_manifest"
- "review_report"

---

4.7 ChangeIntent

A "ChangeIntent" represents a proposed engineering modification.

Required fields:

id:
schemaVersion:
projectId:
baseRevisionId:
targetBranch:
title:
requestText:
changeType:
requestedOperations:
expectedObjectChanges:
preserve:
optimize:
constraints:
approvalPolicy:
status:
createdBy:
createdAt:
updatedAt:
metadata:

Required statuses:

- "captured"
- "planned"
- "executing"
- "generated"
- "validating"
- "validated"
- "review"
- "accepted"
- "rejected"
- "failed"
- "cancelled"

---

4.8 ValidationResult

A "ValidationResult" records one immutable validation execution.

Required fields:

id:
schemaVersion:
projectId:
revisionId:
changeIntentId:
validator:
validatorVersion:
validationType:
status:
startedAt:
completedAt:
durationMs:
diagnostics:
metrics:
artifactIds:
environment:
inputHash:
createdAt:
metadata:

Required validation types:

- "schema"
- "repository_integrity"
- "kicad_import"
- "erc"
- "drc"
- "bom"
- "constraint"
- "artifact_integrity"
- "merge_gate"

Required statuses:

- "pass"
- "warning"
- "fail"
- "error"
- "unknown"
- "skipped"

Validation records must never be overwritten.

---

4.9 Module

A "Module" represents a reusable versioned hardware subsystem.

Required fields:

id:
schemaVersion:
namespace:
name:
version:
description:
sourceProjectId:
sourceRevisionId:
interfaces:
requirements:
constraints:
dependencies:
artifactIds:
bomItemIds:
verificationStatus:
license:
maintainers:
createdAt:
publishedAt:
metadata:

Required verification statuses:

- "unverified"
- "community"
- "reviewed"
- "validated"
- "deprecated"
- "revoked"

The module registry must be implemented at the contract and persistence level.

A public marketplace is not required in v0.1.

---

5. ENGINEERING GRAPH

Implement a revision-scoped engineering graph.

Required relationship types:

- "contains"
- "depends_on"
- "connects_to"
- "powered_by"
- "implemented_by"
- "constrained_by"
- "validated_by"
- "represented_by"
- "replaces"
- "derived_from"
- "supplied_by"
- "instantiates"
- "supersedes"

The graph must support:

- Object lookup by semantic key
- Outbound dependency traversal
- Inbound dependency traversal
- Affected-object calculation
- Graph snapshot hashing
- Comparison between revisions
- Constraint target resolution
- Decision-to-object linkage
- Artifact-to-object linkage

The graph may initially use relational tables and adjacency records.

Do not add a separate graph database unless evidence proves it necessary.

---

6. GIT ADAPTER

Implement a restricted Git adapter.

Required operations:

- Initialize or register repository
- Validate repository state
- Read branches
- Create branch
- Resolve commit SHA
- Read commit metadata
- List changed files
- Compare commits
- Check ancestry
- Detect stale pull-request base
- Create merge commit or approved fast-forward
- Restore working tree for isolated processing

Requirements:

- Do not permit arbitrary shell-command construction from user input.
- Validate branch names and repository paths.
- Prevent path traversal.
- Use argument arrays rather than interpolated shell strings.
- Add execution timeouts.
- Capture stdout, stderr, exit code, and tool version.
- Preserve audit records.

LogicHub revisions must reference real Git SHAs.

---

7. KICAD ADAPTER

Support one pinned KiCad major version for v0.1.

Detect and record the actual KiCad version used.

Required import support:

- ".kicad_pro"
- ".kicad_sch"
- ".kicad_pcb"
- Project-local symbol and footprint references where available
- BOM data generated from the project
- ERC result
- DRC result

Required operations:

inspect_project
validate_project_files
extract_schematic_objects
extract_pcb_objects
extract_bom
render_schematic
render_pcb_layers
run_erc
run_drc
collect_diagnostics
collect_tool_metadata

Requirements:

- Do not modify imported source files during inspection.
- Run KiCad operations inside an isolated working directory.
- Pin or record the KiCad toolchain version.
- Apply execution timeouts and resource limits.
- Capture complete diagnostics.
- Store generated reports as immutable artifacts.
- Mark unsupported constructs as "unknown" or "requires_validation".

Do not claim support for every KiCad version.

---

8. DIFF ENGINE

Implement four diff classes.

---

8.1 Git file diff

Show:

- Added files
- Modified files
- Deleted files
- Renamed files
- Binary changes
- Text changes

---

8.2 Engineering-object diff

Required change types:

- "added"
- "removed"
- "modified"
- "moved"
- "renamed"
- "reconnected"
- "replaced"
- "unchanged"

Compare objects using:

1. Stable source identity where available
2. Semantic key
3. Object properties
4. Connectivity
5. Geometry
6. Content and semantic hashes

The output must explain which properties changed.

Example:

objectType: component
semanticKey: power.regulator.main
changeType: replaced
before:
  manufacturerPartNumber: OLD-PART
  footprint: Package_SO:SOIC-8
after:
  manufacturerPartNumber: NEW-PART
  footprint: Package_DFN:DFN-10
effects:
  - bom_cost_changed
  - footprint_changed
  - pcb_geometry_changed

---

8.3 BOM diff

Normalize BOM entries by:

- Manufacturer
- Manufacturer part number
- Reference designators
- Quantity
- Value
- Footprint
- Description
- Supplier data where available

Required outputs:

- Added parts
- Removed parts
- Replaced parts
- Quantity changes
- Value changes
- Footprint changes
- Cost changes where evidence exists
- Unknown-cost items
- Supply-risk fields where evidence exists

Never invent prices, stock, or lead times.

Supplier values must include source and retrieval timestamp.

---

8.4 Visual diff

Schematic visual diff

Generate:

- Base SVG
- Head SVG
- Overlay SVG or PNG
- Side-by-side view
- Sheet navigation
- Added-object highlighting
- Removed-object highlighting
- Modified-object highlighting

PCB visual diff

Generate:

- Board outline comparison
- Layer-by-layer comparison
- Footprint movement
- Track changes
- Via changes
- Zone changes
- Added and removed copper
- Side-by-side view
- Overlay view

Use a consistent visual convention:

- Removed: red
- Added: green
- Modified: amber
- Unchanged context: neutral gray

Include an accessible text summary for every visual diff.

Visual output is evidence only.

Structural diff remains authoritative for semantic changes.

---

9. CONSTRAINT ENGINE

Implement a safe typed constraint evaluator.

Minimum supported operators:

- Equality
- Inequality
- Numeric range
- Membership
- Presence
- Absence
- Maximum
- Minimum
- Count
- Sum
- Object-property comparison
- Relationship existence

Example constraints:

- name: Maximum board width
  category: mechanical
  severity: blocking
  scope: revision
  expression:
    operator: less_than_or_equal
    left:
      object: pcb.main
      property: boundingBox.widthMm
    right: 100

- name: Maximum BOM line count
  category: cost
  severity: warning
  scope: revision
  expression:
    operator: less_than_or_equal
    left:
      aggregate: count
      objectType: bom_item
    right: 60

- name: Required protection component
  category: electrical
  severity: blocking
  scope: revision
  expression:
    operator: exists
    query:
      objectType: component
      semanticKey: power.input.protection

Required behavior:

- Produce deterministic evaluation.
- Record all input values.
- Explain the result.
- Attach affected object IDs.
- Return "unknown" when input data is unavailable.
- Reject unsupported operators.
- Never execute arbitrary code.

---

10. ENGINEERING PULL REQUEST CONTRACT

Implement an "EngineeringPullRequest" domain object in addition to the nine primary contracts.

Required fields:

id:
schemaVersion:
projectId:
number:
title:
description:
baseBranch:
baseRevisionId:
headBranch:
headRevisionId:
changeIntentId:
author:
status:
reviewState:
requiredApprovals:
approvals:
changeRequests:
diffSummary:
validationSummary:
constraintSummary:
mergeEligibility:
createdAt:
updatedAt:
mergedAt:
mergedRevisionId:
metadata:

Required PR statuses:

- "draft"
- "open"
- "changes_requested"
- "approved"
- "merged"
- "closed"
- "rejected"

Required review decisions:

- "comment"
- "approve"
- "request_changes"

---

11. MERGE GATES

A pull request may merge only when all conditions pass:

1. Base and head revisions belong to the same project.
2. Head revision descends from the declared base revision.
3. Base revision has not become stale.
4. Revision manifests pass integrity validation.
5. Artifact hashes are valid.
6. Required schema validations pass.
7. KiCad import validation passes.
8. ERC does not contain blocking failures.
9. DRC does not contain blocking failures.
10. No blocking constraint is violated.
11. No required validation remains "unknown".
12. Required decision records exist.
13. Required approval count is satisfied.
14. No active "request_changes" review remains unresolved.
15. The repository working tree is clean.
16. The merge operation produces a new immutable revision.

Merge eligibility must be recalculated immediately before merge.

Do not trust an earlier cached merge result.

---

12. API CONTRACT

Implement REST endpoints or an equivalent typed API.

Minimum endpoints:

POST   /projects
POST   /projects/import
GET    /projects
GET    /projects/:projectId

GET    /projects/:projectId/branches
POST   /projects/:projectId/branches

POST   /projects/:projectId/revisions/import
GET    /projects/:projectId/revisions
GET    /revisions/:revisionId

POST   /projects/:projectId/change-intents
GET    /change-intents/:changeIntentId

POST   /revisions/:revisionId/validate
GET    /revisions/:revisionId/validations

GET    /revisions/:baseRevisionId/diff/:headRevisionId

POST   /projects/:projectId/pull-requests
GET    /projects/:projectId/pull-requests
GET    /pull-requests/:pullRequestId

POST   /pull-requests/:pullRequestId/reviews
POST   /pull-requests/:pullRequestId/recalculate
POST   /pull-requests/:pullRequestId/merge

GET    /artifacts/:artifactId
GET    /modules
POST   /modules
GET    /modules/:moduleId

Requirements:

- Validate every request.
- Return typed errors.
- Use stable error codes.
- Never expose internal filesystem paths.
- Include correlation IDs.
- Add pagination where result sets can grow.

---

13. WEB APPLICATION

Implement a usable browser interface.

Required pages:

Projects

Show:

- Project name
- Visibility
- Default branch
- Latest revision
- Validation status
- Open pull requests

Project detail

Show:

- Branches
- Revisions
- Recent decisions
- Constraints
- Validation history
- Pull requests

Revision detail

Show:

- Git SHA
- Author
- Message
- Toolchain
- Engineering-object summary
- BOM
- Constraints
- Decisions
- Validation records
- Artifacts

Pull-request list

Show:

- Number
- Title
- Base branch
- Head branch
- Author
- Review state
- Validation state
- Merge eligibility

Engineering pull-request view

Required tabs:

1. Overview
2. Intent
3. Files
4. Schematic
5. PCB
6. BOM
7. Constraints
8. Decisions
9. Validation
10. Reviews

Required actions:

- Comment
- Approve
- Request changes
- Recalculate eligibility
- Merge
- Close

The user interface must clearly distinguish:

- Passing evidence
- Warnings
- Blocking failures
- Missing evidence
- Unknown results

---

14. REFERENCE KICAD FIXTURE

Create a small but meaningful test project:

fixtures/kicad/smart-plant-pot/
├── base/
└── proposed/

The "base" revision should represent:

- A simple USB-powered sensor board
- 5 V input
- Regulated 3.3 V rail
- Microcontroller or representative controller block
- Sensor connector
- LED or simple status output
- Valid schematic
- Valid PCB
- BOM

The "proposed" revision should represent a controlled engineering change such as:

- Input changed from 5 V USB to a higher-voltage battery input
- Added or replaced voltage regulator
- Added input protection
- Updated connector
- Updated BOM
- Updated PCB footprints or placement
- Updated traces where necessary

The fixture must include:

- One meaningful component replacement
- One added component
- One removed component
- One BOM quantity change
- One footprint or placement change
- One warning-level constraint
- At least one passing blocking constraint
- One accepted decision record
- Passing ERC
- Passing DRC, or a documented intentionally failing branch used only for merge-gate testing

Do not fake KiCad validation results.

If the fixture cannot pass real validation, repair the fixture.

---

15. END-TO-END DEMONSTRATION

Implement an automated demonstration covering:

Import base KiCad repository
        ↓
Create Project
        ↓
Create baseline Revision
        ↓
Extract engineering objects
        ↓
Generate baseline BOM
        ↓
Run baseline ERC and DRC
        ↓
Create feature branch
        ↓
Import proposed revision
        ↓
Create ChangeIntent
        ↓
Generate semantic and visual diffs
        ↓
Generate BOM delta
        ↓
Evaluate constraints
        ↓
Attach Decision
        ↓
Run ERC and DRC
        ↓
Create Engineering Pull Request
        ↓
Display all evidence
        ↓
Submit review approval
        ↓
Recalculate merge eligibility
        ↓
Merge
        ↓
Create immutable merged Revision
        ↓
Verify artifact and snapshot hashes

The full workflow must run through an automated integration test.

A browser-based Playwright test must exercise the primary user path.

---

16. STATE MACHINES

Document and enforce state transitions.

ChangeIntent

captured
  → planned
  → executing
  → generated
  → validating
  → validated
  → review
  → accepted

Any active state
  → failed
  → cancelled
  → rejected

Revision

draft
  → imported
  → validating
  → validated
  → review
  → merged

Any pre-merge state
  → failed
  → rejected

Pull request

draft
  → open
  → changes_requested
  → open
  → approved
  → merged

draft/open/changes_requested/approved
  → closed
  → rejected

Invalid transitions must return typed errors.

---

17. ERROR MODEL

Implement stable error codes.

Minimum codes:

LH_PROJECT_NOT_FOUND
LH_REPOSITORY_INVALID
LH_REPOSITORY_DIRTY
LH_GIT_REF_NOT_FOUND
LH_GIT_ANCESTRY_INVALID
LH_REVISION_NOT_FOUND
LH_REVISION_IMMUTABLE
LH_REVISION_STALE
LH_SCHEMA_INVALID
LH_ENGINEERING_OBJECT_INVALID
LH_KICAD_PROJECT_INVALID
LH_KICAD_VERSION_UNSUPPORTED
LH_KICAD_IMPORT_FAILED
LH_ERC_FAILED
LH_DRC_FAILED
LH_CONSTRAINT_VIOLATION
LH_VALIDATION_REQUIRED
LH_VALIDATION_FAILED
LH_ARTIFACT_HASH_MISMATCH
LH_ARTIFACT_NOT_FOUND
LH_DECISION_REQUIRED
LH_REVIEW_REQUIRED
LH_CHANGES_REQUESTED
LH_MERGE_BLOCKED
LH_STATE_TRANSITION_INVALID
LH_TIMEOUT
LH_RESOURCE_LIMIT
LH_INTERNAL_ERROR

Every error response must include:

- Code
- Message
- Correlation ID
- Retryability
- Relevant entity IDs
- Safe diagnostics

Do not leak secrets or internal shell commands.

---

18. SECURITY BOUNDARY

Implement at minimum:

- Repository path allowlisting
- Archive extraction protection
- Path traversal prevention
- File-size limits
- Project-size limits
- Tool execution timeouts
- KiCad process resource limits
- Safe subprocess argument handling
- MIME-type verification
- SHA-256 verification
- Read-only import stage
- Isolated temporary workspaces
- Cleanup after tool execution
- Structured audit events

Do not execute arbitrary project scripts during import.

Do not automatically trust Git hooks.

Disable or bypass repository hooks in controlled execution environments.

---

19. OBSERVABILITY

Emit structured events.

Minimum event names:

project.created
project.import.started
project.import.completed
project.import.failed

revision.imported
revision.snapshot.created
revision.validation.started
revision.validation.completed
revision.validation.failed

engineering_object.extracted
engineering_graph.snapshot.created

artifact.created
artifact.hash.verified
artifact.hash.failed

diff.started
diff.completed
diff.failed

constraint.evaluated
constraint.violated
constraint.unknown

decision.created
decision.accepted
decision.superseded

pull_request.created
pull_request.reviewed
pull_request.changes_requested
pull_request.approved
pull_request.merge_blocked
pull_request.merged

kicad.erc.completed
kicad.drc.completed

security.denied
tool.timeout
state.invalid

Record:

- Timestamp
- Project ID
- Revision ID
- Pull-request ID
- Actor
- Correlation ID
- Duration
- Result
- Error code where relevant

---

20. TEST REQUIREMENTS

Contract tests

Test:

- Valid serialization
- Invalid input rejection
- Enum enforcement
- Schema-version handling
- JSON Schema parity
- Backward-compatible deserialization policy

Domain tests

Test:

- Revision immutability
- State-machine transitions
- Merge-gate calculation
- Approval handling
- Change-request blocking
- Constraint evaluation
- Decision requirements
- Snapshot hashing

Git tests

Test:

- Branch creation
- Commit resolution
- Ancestry
- Stale base detection
- Dirty repository rejection
- Merge behavior

KiCad tests

Test:

- Valid project import
- Invalid project rejection
- Object extraction
- BOM extraction
- Schematic rendering
- PCB rendering
- ERC execution
- DRC execution
- Tool-version recording

Diff tests

Test:

- Added component
- Removed component
- Replaced component
- Net reconnection
- Footprint movement
- Track change
- BOM quantity change
- Constraint change
- Decision change

Artifact tests

Test:

- Hash calculation
- Deduplication
- Tamper detection
- Provenance
- Immutable storage behavior

Pull-request tests

Test:

- Draft PR
- Approval
- Request changes
- Reapproval
- Merge blocked by ERC
- Merge blocked by DRC
- Merge blocked by constraint
- Merge blocked by unknown validation
- Merge blocked by stale base
- Successful merge

End-to-end tests

At least one complete automated KiCad workflow must pass.

---

21. DOCUMENTATION DELIVERABLES

Create:

README.md
docs/architecture/system-overview.md
docs/architecture/domain-model.md
docs/architecture/engineering-graph.md
docs/architecture/artifact-storage.md
docs/architecture/security-boundary.md

docs/contracts/project.md
docs/contracts/revision.md
docs/contracts/engineering-object.md
docs/contracts/constraint.md
docs/contracts/decision.md
docs/contracts/artifact.md
docs/contracts/change-intent.md
docs/contracts/validation-result.md
docs/contracts/module.md
docs/contracts/engineering-pull-request.md

docs/workflows/kicad-import.md
docs/workflows/revision-diff.md
docs/workflows/engineering-pr.md
docs/workflows/review-and-merge.md

docs/validation/kicad-erc-drc.md
docs/validation/constraint-engine.md
docs/validation/merge-gates.md

docs/operations/local-development.md
docs/operations/testing.md
docs/operations/troubleshooting.md

Documentation must explain:

- Why the architecture exists
- What is authoritative
- What is derived
- What is immutable
- What can fail
- How results are reproduced
- How unsupported KiCad constructs are handled
- How a future Zayvora integration can submit typed change intents
- How future DAXINI workers can execute isolated validation jobs

Do not implement Zayvora or DAXINI integration in this task.

Create clean interfaces for later integration.

---

22. REQUIRED COMMANDS

Provide working commands similar to:

pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e

pnpm dev

pnpm logichub project import ./fixtures/kicad/smart-plant-pot/base
pnpm logichub revision validate <revision-id>
pnpm logichub revision diff <base-id> <head-id>
pnpm logichub pr create <base-id> <head-id>
pnpm logichub pr merge <pr-id>

Exact command names may differ, but equivalent workflows must exist.

---

23. IMPLEMENTATION PHASES

Phase 0 — Repository audit and architecture freeze

- Inspect existing files.
- Preserve useful existing work.
- Document current architecture.
- Freeze contracts and state machines.
- Add ADRs for major choices.

Exit condition: all core contracts and relationships are documented before UI implementation.

Phase 1 — Contracts and domain model

- Implement all schemas.
- Add runtime validation.
- Generate JSON Schema.
- Add serialization tests.
- Implement state transitions.

Exit condition: all contract tests pass.

Phase 2 — Persistence and artifact storage

- Add migrations.
- Implement repositories.
- Implement immutable revision storage.
- Implement content-addressed artifacts.
- Implement snapshot hashing.

Exit condition: a revision can be stored, restored, and integrity-checked.

Phase 3 — Git adapter

- Register repositories.
- Resolve branches and commits.
- Detect ancestry and stale bases.
- Create controlled merges.

Exit condition: two Git revisions can be registered and compared.

Phase 4 — KiCad importer

- Parse project files.
- Extract semantic objects.
- Extract BOM.
- Generate renders.
- Run ERC and DRC.

Exit condition: fixture projects import successfully and generate evidence.

Phase 5 — Diff and constraint engines

- Generate file diff.
- Generate engineering-object diff.
- Generate visual diff.
- Generate BOM diff.
- Evaluate constraints.

Exit condition: all intended fixture changes appear correctly.

Phase 6 — Pull requests and reviews

- Create engineering PR.
- Add review workflow.
- Add merge gates.
- Add merge operation.

Exit condition: failing evidence blocks merge and passing evidence permits merge.

Phase 7 — Web application

- Build project pages.
- Build revision pages.
- Build engineering PR interface.
- Add review and merge controls.

Exit condition: the full workflow is usable in the browser.

Phase 8 — End-to-end validation

- Run complete automated flow.
- Add Playwright coverage.
- Verify deterministic outputs.
- Verify artifact hashes.
- Complete documentation.

Exit condition: all pass criteria are satisfied.

---

24. EXPLICIT NON-GOALS

Do not implement:

- General prompt-to-CAD generation
- Autonomous PCB routing
- Autonomous schematic generation
- General mechanical CAD generation
- Multi-CAD support
- Altium support
- OrCAD support
- Eagle support
- Cloud deployment
- Kubernetes
- Enterprise SSO
- Billing
- Public module marketplace
- Real-time multi-user CAD editing
- PLM integration
- Supplier purchasing
- AI-generated electrical approval
- Automatic merging
- Arbitrary project-script execution
- Complete GitHub synchronization
- Full binary-CAD merging

Build extension points without expanding v0.1 scope.

---

25. ACCEPTANCE CRITERIA

The task is complete only when all conditions pass.

Repository contract

- All required schemas exist.
- Every schema has TypeScript, runtime validation, JSON Schema, persistence, documentation, and tests.
- Schema versions are explicit.
- Invalid records are rejected.

Revision integrity

- Revisions reference real Git SHAs.
- Revision snapshots are immutable.
- Snapshot hashes are deterministic.
- Artifact tampering is detected.
- Revisions can be restored.

KiCad workflow

- A real KiCad project imports.
- Schematic objects are extracted.
- PCB objects are extracted.
- BOM is extracted.
- Schematic renders are produced.
- PCB renders are produced.
- ERC runs.
- DRC runs.
- Tool versions are recorded.

Diff workflow

- File diff works.
- Engineering-object diff works.
- Schematic visual diff works.
- PCB visual diff works.
- BOM delta works.
- Constraint changes work.
- Decision changes work.

Review workflow

- Engineering pull requests can be created.
- Reviews can be submitted.
- Changes can be requested.
- Approvals can be submitted.
- Merge eligibility is visible.
- Blocking failures prevent merge.
- Stale base revisions prevent merge.
- Successful merge creates an immutable revision.

User interface

- Projects are visible.
- Revisions are visible.
- Pull requests are visible.
- Visual diffs are visible.
- BOM changes are visible.
- Constraints are visible.
- Decisions are visible.
- Validation evidence is visible.
- Review actions work.
- Merge action works only when eligible.

Testing

- Unit tests pass.
- Contract tests pass.
- Integration tests pass.
- End-to-end tests pass.
- Type checking passes.
- Linting passes.
- Build passes.
- No critical workflow depends on mocks.

Documentation

- Architecture is documented.
- Contracts are documented.
- KiCad workflow is documented.
- Security boundary is documented.
- Merge gates are documented.
- Local setup is documented.
- Troubleshooting is documented.

---

BLOCK EXPLANATIONS

Repository contract

Defines the stable engineering entities that every future LogicHub feature will use.

Git layer

Provides trusted branching, commit history, ancestry, and merge operations without rebuilding source control.

Engineering graph

Connects components, nets, footprints, constraints, decisions, artifacts, and validation evidence.

KiCad adapter

Transforms KiCad files into normalized engineering objects and deterministic validation results.

Diff engine

Explains what changed at the file, semantic, visual, BOM, constraint, and decision levels.

Pull-request engine

Turns hardware changes into reviewable, merge-gated engineering proposals.

Artifact store

Preserves immutable renders, reports, manifests, and validation evidence.

Web interface

Makes engineering changes understandable without requiring reviewers to inspect raw KiCad files.

---

RISKS / FAILURE MODES

KiCad-version incompatibility

Mitigation:

- Pin one supported version.
- Detect tool version.
- Reject unsupported versions clearly.
- Preserve original source files.

Unstable semantic identities

Mitigation:

- Use KiCad UUIDs where available.
- Add normalized semantic keys.
- Test rename, move, and replacement behavior.
- Do not rely on file position.

False visual diffs

Mitigation:

- Normalize viewbox, scale, origin, orientation, and layer visibility.
- Pair visual results with structural diffs.

Stale validation

Mitigation:

- Tie every validation to revision hash and input hash.
- Recalculate merge eligibility before merge.

Missing engineering evidence

Mitigation:

- Use "unknown" and "requires_validation".
- Prevent merge when required evidence is missing.

Unsafe tool execution

Mitigation:

- Isolated workspaces
- No arbitrary shell strings
- Resource limits
- Timeouts
- Read-only import
- Disabled Git hooks

Scope expansion

Mitigation:

- Maintain explicit non-goals.
- Do not add new CAD formats.
- Do not add autonomous design generation.
- Complete the repository contract before AI features.

---

MONETISATION LOGIC

This implementation establishes the recurring-value layer for:

- Private hardware repositories
- Organization workspaces
- Protected engineering branches
- Engineering review controls
- Validation compute
- BOM intelligence
- Supply-chain alerts
- Verified reusable modules
- Audit trails
- Enterprise policy enforcement
- Manufacturing release workflows

The defensible product is not only CAD generation.

The defensible product is the engineering history, constraint state, validation evidence, reusable modules, and collaborative review workflow accumulated across hardware projects.

---

FEASIBILITY + EFFORT

High feasibility

- Git-backed revisions
- Contract schemas
- BOM extraction
- ERC and DRC execution
- Review workflows
- Constraint evaluation
- Artifact hashing

Medium-to-high feasibility

- Stable engineering-object matching
- Schematic visual comparison
- PCB layer comparison
- Semantic connectivity diffs

Deferred high-risk scope

- General prompt-to-PCB
- Cross-CAD semantic merging
- Mechanical propagation
- Autonomous placement and routing
- Full supplier-data integration

Expected implementation difficulty: High but feasible with frozen scope.

---

VERDICT

GO

Proceed with the LogicHub v0.1 Engineering Repository Contract and KiCad collaboration foundation.

Do not expand into unrestricted AI hardware generation until this layer reliably handles:

- State
- Revisions
- Constraints
- Decisions
- Validation
- Reviews
- Provenance
- Merge safety

---

ONE NEXT ACTION

Inspect or initialize "via-decide/logichub", create the contract and architecture documents first, and do not begin the web interface until all required schemas, state machines, hashes, and merge-gate rules are frozen and covered by contract tests.

---

FINAL CLAUDE REPORT FORMAT

At task completion, return:

1. Executive summary
2. Architecture implemented
3. Contracts implemented
4. KiCad adapter status
5. Diff capabilities
6. Validation capabilities
7. Pull-request workflow
8. Web interface status
9. Files created and modified
10. Tests executed
11. Test results
12. Known limitations
13. Deferred scope
14. Security review
15. Reproduction commands
16. Final verdict

Do not report success unless the complete import → diff → validation → engineering PR → review → merge workflow has executed successfully using the included KiCad fixture.
