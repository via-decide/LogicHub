export { createDatabase, type DatabaseOptions } from './database.js';
export { runMigrations } from './migrations/index.js';

export type {
  ProjectRepository,
  RevisionRepository,
  EngineeringObjectRepository,
  ConstraintRepository,
  DecisionRepository,
  ArtifactRepository,
  ChangeIntentRepository,
  ValidationResultRepository,
  ModuleRepository,
  EngineeringPullRequestRepository,
} from './repositories/interfaces.js';

export { SqliteProjectRepository } from './repositories/project.repository.js';
export { SqliteRevisionRepository } from './repositories/revision.repository.js';
export { SqliteEngineeringObjectRepository } from './repositories/engineering-object.repository.js';
export { SqliteConstraintRepository } from './repositories/constraint.repository.js';
export { SqliteDecisionRepository } from './repositories/decision.repository.js';
export { SqliteArtifactRepository } from './repositories/artifact.repository.js';
export { SqliteChangeIntentRepository } from './repositories/change-intent.repository.js';
export { SqliteValidationResultRepository } from './repositories/validation-result.repository.js';
export { SqliteModuleRepository } from './repositories/module.repository.js';
export { SqliteEngineeringPullRequestRepository } from './repositories/engineering-pull-request.repository.js';

export { computeSnapshotHashes, type SnapshotHashes } from './hashing/snapshot-hasher.js';
export { computeSha256 } from './hashing/content-hasher.js';
