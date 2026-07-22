import { z } from 'zod';
import {
  OperationIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  EngineeringPullRequestIdSchema,
  ISODateTimeSchema,
  Sha256Schema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';

export const OperationTypeSchema = z.enum([
  'import_project',
  'import_revision',
  'validate_revision',
  'diff_revisions',
  'create_pull_request',
  'merge_pull_request',
]);
export type OperationType = z.infer<typeof OperationTypeSchema>;

export const OperationStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'cleaning_up',
]);
export type OperationStatus = z.infer<typeof OperationStatusSchema>;

export const OperationStageSchema = z.object({
  name: z.string().min(1),
  status: OperationStatusSchema,
  startedAt: ISODateTimeSchema.optional(),
  completedAt: ISODateTimeSchema.optional(),
  error: z.string().optional(),
});
export type OperationStage = z.infer<typeof OperationStageSchema>;

export const OperationDiagnosticSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string().min(1),
  timestamp: ISODateTimeSchema,
});
export type OperationDiagnostic = z.infer<typeof OperationDiagnosticSchema>;

export const OperationSchema = z.object({
  id: OperationIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  type: OperationTypeSchema,
  idempotencyKey: z.string().min(1),
  correlationId: z.string().min(1),
  projectId: ProjectIdSchema,
  revisionId: RevisionIdSchema.optional(),
  pullRequestId: EngineeringPullRequestIdSchema.optional(),
  status: OperationStatusSchema.default('queued'),
  stages: z.array(OperationStageSchema).default([]),
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().nonnegative().default(3),
  artifacts: z.array(Sha256Schema).default([]),
  workspacePath: z.string().optional(),
  cleanupRequired: z.boolean().default(false),
  error: z.string().optional(),
  diagnostics: z.array(OperationDiagnosticSchema).default([]),
  createdAt: ISODateTimeSchema,
  startedAt: ISODateTimeSchema.optional(),
  completedAt: ISODateTimeSchema.optional(),
});
export type Operation = z.infer<typeof OperationSchema>;
