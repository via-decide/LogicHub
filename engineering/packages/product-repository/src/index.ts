export {
  ProductIntentSchema, type ProductIntent,
  RevisionStampSchema, type RevisionStamp,
  ProductRevisionSchema, type ProductRevision,
} from './schemas/revision.schema.js';

export {
  ChangeKindSchema, type ChangeKind,
  SemanticChangeSchema, type SemanticChange,
  AffectedAreaSchema, type AffectedArea,
  CheckVerdictSchema, type CheckVerdict,
  ValidationCheckSchema, type ValidationCheck,
  SemanticProductDiffSchema, type SemanticProductDiff,
} from './schemas/diff.schema.js';

export {
  ValidationDecisionSchema, type ValidationDecision,
  EvidenceBindingSchema, type EvidenceBinding,
  StalenessReasonSchema, type StalenessReason,
  StalenessRecordSchema, type StalenessRecord,
  ReviewRecordSchema, type ReviewRecord,
  ReleaseBlockerSchema, type ReleaseBlocker,
  ReleaseDecisionSchema, type ReleaseDecision,
} from './schemas/governance.schema.js';

export { semanticDiff } from './diff/semantic-diff.js';

export {
  assessThermal,
  type GraphThermalResult,
  type ThermalVerdict,
} from './thermal/graph-thermal.js';

export {
  touchedSubjects,
  detectStaleDecisions,
  detectStaleEvidence,
} from './governance/staleness.js';

export { decideRelease, type ReleaseRequest } from './governance/release.js';

export { ProductRepository, type CommitInput } from './repository/product-repository.js';
