export { generateId, isoNow } from './id-generator.js';

export { KicadAdapter } from '@logichub-engineering/kicad-adapter';

export {
  type DomainEventName,
  type DomainEvent,
  type DomainEventSink,
} from './events.js';

export {
  ImportService,
  type ImportServiceDeps,
  type ImportRevisionInput,
  type ImportRevisionResult,
} from './import-service.js';

export {
  RevisionComparisonService,
  type RevisionComparisonDeps,
  type RevisionComparisonResult,
} from './revision-comparison-service.js';

export {
  evaluateConstraint,
  evaluateConstraints,
  hasBlockingConstraintViolation,
  parseConstraintExpression,
  type ConstraintExpression,
  type ConstraintEvaluationOutcome,
} from './constraint-evaluation.js';

export {
  VisualDiffService,
  type VisualDiffResult,
  type VisualDiffPane,
  type VisualDiffSide,
  type RevisionRenderTarget,
} from './visual-diff-service.js';

export {
  MergeService,
  type MergeServiceDeps,
  type MergePullRequestResult,
} from './merge-service.js';

export { ReviewService, type ReviewServiceDeps } from './review-service.js';

export { BranchService, type BranchServiceDeps } from './branch-service.js';

export {
  CatalogService,
  type CatalogServiceDeps,
  type CreateProjectInput,
  type CreateChangeIntentInput,
  type CreateModuleInput,
  type CreatePullRequestInput,
} from './catalog-service.js';
