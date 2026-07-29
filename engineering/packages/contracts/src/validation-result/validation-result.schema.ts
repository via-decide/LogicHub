import { z } from 'zod';
import {
  ValidationResultIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  ChangeIntentIdSchema,
  ArtifactIdSchema,
  ISODateTimeSchema,
  MetadataSchema,
  Sha256Schema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';
import { ValidationTypeSchema, ValidationStatusSchema } from './validation-result.enums.js';

export const DiagnosticSchema = z.object({
  severity: z.enum(['error', 'warning', 'info', 'hint']),
  message: z.string().min(1),
  location: z.unknown().optional(),
  code: z.string().optional(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export const ValidationResultSchema = z.object({
  id: ValidationResultIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  projectId: ProjectIdSchema,
  revisionId: RevisionIdSchema,
  changeIntentId: ChangeIntentIdSchema.optional(),
  validator: z.string().min(1),
  validatorVersion: z.string().min(1),
  validationType: ValidationTypeSchema,
  status: ValidationStatusSchema,
  startedAt: ISODateTimeSchema,
  completedAt: ISODateTimeSchema.optional(),
  durationMs: z.number().int().nonnegative().optional(),
  diagnostics: z.array(DiagnosticSchema),
  metrics: z.record(z.string(), z.number()).optional(),
  artifactIds: z.array(ArtifactIdSchema),
  environment: z.record(z.string(), z.string()).optional(),
  inputHash: Sha256Schema.optional(),
  createdAt: ISODateTimeSchema,
  metadata: MetadataSchema,
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
