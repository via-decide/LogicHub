import { z } from 'zod';
import {
  ModuleIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  ArtifactIdSchema,
  ISODateTimeSchema,
  MetadataSchema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';
import { VerificationStatusSchema } from './module.enums.js';

export const ModuleDependencySchema = z.object({
  moduleId: ModuleIdSchema,
  versionConstraint: z.string().min(1),
});
export type ModuleDependency = z.infer<typeof ModuleDependencySchema>;

export const ModuleSchema = z.object({
  id: ModuleIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  namespace: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  sourceProjectId: ProjectIdSchema.optional(),
  sourceRevisionId: RevisionIdSchema.optional(),
  interfaces: z.array(z.unknown()),
  requirements: z.array(z.string()),
  constraints: z.array(z.unknown()),
  dependencies: z.array(ModuleDependencySchema),
  artifactIds: z.array(ArtifactIdSchema),
  bomItemIds: z.array(z.string()),
  verificationStatus: VerificationStatusSchema.default('unverified'),
  license: z.string().optional(),
  maintainers: z.array(z.string()),
  createdAt: ISODateTimeSchema,
  publishedAt: ISODateTimeSchema.optional(),
  metadata: MetadataSchema,
});
export type Module = z.infer<typeof ModuleSchema>;
