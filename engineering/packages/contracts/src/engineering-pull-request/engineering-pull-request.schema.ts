import { z } from 'zod';
import {
  EngineeringPullRequestIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  ChangeIntentIdSchema,
  ISODateTimeSchema,
  MetadataSchema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';
import { PRStatusSchema, ReviewDecisionSchema } from './engineering-pull-request.enums.js';

export const MergeBlockerSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type MergeBlocker = z.infer<typeof MergeBlockerSchema>;

export const MergeEligibilitySchema = z.object({
  eligible: z.boolean(),
  blockers: z.array(MergeBlockerSchema),
});
export type MergeEligibility = z.infer<typeof MergeEligibilitySchema>;

export const DiffSummarySchema = z.object({
  filesAdded: z.number().int().nonnegative(),
  filesModified: z.number().int().nonnegative(),
  filesDeleted: z.number().int().nonnegative(),
  objectsAdded: z.number().int().nonnegative(),
  objectsModified: z.number().int().nonnegative(),
  objectsRemoved: z.number().int().nonnegative(),
});
export type DiffSummary = z.infer<typeof DiffSummarySchema>;

export const ValidationSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});
export type ValidationSummary = z.infer<typeof ValidationSummarySchema>;

export const ConstraintSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  violations: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});
export type ConstraintSummary = z.infer<typeof ConstraintSummarySchema>;

export const ReviewRecordSchema = z.object({
  reviewer: z.string().min(1),
  decision: ReviewDecisionSchema,
  comment: z.string().optional(),
  createdAt: ISODateTimeSchema,
});
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

export const EngineeringPullRequestSchema = z.object({
  id: EngineeringPullRequestIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  projectId: ProjectIdSchema,
  number: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().optional(),
  baseBranch: z.string().min(1),
  baseRevisionId: RevisionIdSchema,
  headBranch: z.string().min(1),
  headRevisionId: RevisionIdSchema,
  changeIntentId: ChangeIntentIdSchema.optional(),
  author: z.string().min(1),
  status: PRStatusSchema.default('draft'),
  reviewState: PRStatusSchema.optional(),
  requiredApprovals: z.number().int().min(1).default(1),
  approvals: z.array(ReviewRecordSchema),
  changeRequests: z.array(ReviewRecordSchema),
  diffSummary: DiffSummarySchema.optional(),
  validationSummary: ValidationSummarySchema.optional(),
  constraintSummary: ConstraintSummarySchema.optional(),
  mergeEligibility: MergeEligibilitySchema.optional(),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema.optional(),
  mergedAt: ISODateTimeSchema.optional(),
  mergedRevisionId: RevisionIdSchema.optional(),
  metadata: MetadataSchema,
});
export type EngineeringPullRequest = z.infer<typeof EngineeringPullRequestSchema>;
