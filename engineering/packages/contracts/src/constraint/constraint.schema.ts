import { z } from 'zod';
import {
  ConstraintIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  EngineeringObjectIdSchema,
  ISODateTimeSchema,
  MetadataSchema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';
import { ConstraintCategorySchema, ConstraintSeveritySchema, ConstraintEvaluationSchema } from './constraint.enums.js';

export const ConstraintSchema = z.object({
  id: ConstraintIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  projectId: ProjectIdSchema,
  revisionId: RevisionIdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  category: ConstraintCategorySchema,
  severity: ConstraintSeveritySchema,
  scope: z.string().min(1),
  targetObjectIds: z.array(EngineeringObjectIdSchema),
  expression: z.unknown(),
  unit: z.string().optional(),
  expected: z.unknown(),
  source: z.string().optional(),
  status: z.string().default('active'),
  evaluation: ConstraintEvaluationSchema.default('unknown'),
  createdBy: z.string().min(1),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema.optional(),
  metadata: MetadataSchema,
});
export type Constraint = z.infer<typeof ConstraintSchema>;
