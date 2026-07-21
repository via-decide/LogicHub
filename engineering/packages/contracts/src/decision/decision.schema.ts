import { z } from 'zod';
import {
  DecisionIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  ChangeIntentIdSchema,
  ArtifactIdSchema,
  ValidationResultIdSchema,
  ISODateTimeSchema,
  MetadataSchema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';
import { DecisionStatusSchema, DecisionConfidenceSchema } from './decision.enums.js';

export const DecisionAlternativeSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  tradeoffs: z.string().optional(),
});
export type DecisionAlternative = z.infer<typeof DecisionAlternativeSchema>;

export const DecisionSchema = z.object({
  id: DecisionIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  projectId: ProjectIdSchema,
  revisionId: RevisionIdSchema,
  changeIntentId: ChangeIntentIdSchema.optional(),
  question: z.string().min(1),
  context: z.string().optional(),
  alternatives: z.array(DecisionAlternativeSchema),
  selectedAlternative: z.string().optional(),
  rationale: z.string().optional(),
  tradeoffs: z.string().optional(),
  constraintsConsidered: z.array(z.string()),
  evidenceArtifactIds: z.array(ArtifactIdSchema),
  validationResultIds: z.array(ValidationResultIdSchema),
  confidence: DecisionConfidenceSchema.optional(),
  status: DecisionStatusSchema.default('proposed'),
  createdBy: z.string().min(1),
  createdAt: ISODateTimeSchema,
  supersedesDecisionId: DecisionIdSchema.optional(),
  metadata: MetadataSchema,
});
export type Decision = z.infer<typeof DecisionSchema>;
