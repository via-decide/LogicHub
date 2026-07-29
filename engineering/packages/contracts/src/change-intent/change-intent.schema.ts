import { z } from 'zod';
import {
  ChangeIntentIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  ISODateTimeSchema,
  MetadataSchema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';
import { ChangeIntentStatusSchema } from './change-intent.enums.js';

export const ApprovalPolicySchema = z.object({
  requiredApprovals: z.number().int().min(1),
  autoMerge: z.literal(false),
});
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

export const ChangeIntentSchema = z.object({
  id: ChangeIntentIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  projectId: ProjectIdSchema,
  baseRevisionId: RevisionIdSchema,
  targetBranch: z.string().min(1),
  title: z.string().min(1),
  requestText: z.string().optional(),
  changeType: z.string().min(1),
  requestedOperations: z.array(z.unknown()),
  expectedObjectChanges: z.array(z.unknown()),
  preserve: z.array(z.string()),
  optimize: z.array(z.string()),
  constraints: z.array(z.unknown()),
  approvalPolicy: ApprovalPolicySchema,
  status: ChangeIntentStatusSchema.default('captured'),
  createdBy: z.string().min(1),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema.optional(),
  metadata: MetadataSchema,
});
export type ChangeIntent = z.infer<typeof ChangeIntentSchema>;
