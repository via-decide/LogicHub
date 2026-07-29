export {
  AuthorityLevelSchema, type AuthorityLevel,
  PermissionSchema, type Permission,
  ALL_PERMISSIONS,
  PERMISSION_GRANTS,
  permissionsFor,
  holdsPermission,
  assertPermitted,
} from './schemas/authority.schema.js';

export {
  EpistemicStateSchema, type EpistemicState,
  ControlKindSchema, type ControlKind,
  SurfaceControlSchema, type SurfaceControl,
  SurfaceReadoutSchema, type SurfaceReadout,
  SurfaceAlertSchema, type SurfaceAlert,
  SurfaceSectionSchema, type SurfaceSection,
  OfflineBehaviourSchema, type OfflineBehaviour,
  GeneratedSurfaceSchema, type GeneratedSurface,
  SurfaceSetSchema, type SurfaceSet,
} from './schemas/surface.schema.js';

export {
  ObservationStateSchema, type ObservationState,
  MeasurementKindSchema, type MeasurementKind,
  SelfTestStepSchema, type SelfTestStep,
  SelfTestSchema, type SelfTest,
  ObservationSchema, type Observation,
  LikelihoodSchema, type Likelihood,
  PossibleCauseSchema, type PossibleCause,
  FaultCodeSchema, type FaultCode,
  DiagnosisSchema, type Diagnosis,
  MaintenanceEntrySchema, type MaintenanceEntry,
} from './schemas/diagnostics.schema.js';

export {
  SELF_TESTS,
  FAULT_CODES,
  getSelfTest,
  requireSelfTest,
  getFaultCode,
} from './diagnostics/self-tests.js';

export { diagnoseFault } from './diagnostics/fault-tree.js';

export {
  generateAllSurfaces,
  generateOperatorSurface,
  generateEngineeringSurface,
  generateServiceSurface,
  compareRevisions,
  findAuthorityViolations,
  type ServiceSurfaceOptions,
  type RevisionDifference,
  type AuthorityViolation,
} from './generators/index.js';
