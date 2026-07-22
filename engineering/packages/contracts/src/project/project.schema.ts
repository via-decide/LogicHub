import { z } from 'zod';
import {
  ProjectIdSchema,
  ISODateTimeSchema,
  MetadataSchema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';
import { ProjectStatusSchema, ProjectVisibilitySchema } from './project.enums.js';

export const RepositoryInfoSchema = z.object({
  provider: z.string().min(1),
  remoteUrl: z.string().url().optional(),
  localPath: z.string().min(1),
  defaultBranch: z.string().default('main'),
});
export type RepositoryInfo = z.infer<typeof RepositoryInfoSchema>;

export const ProjectSchema = z.object({
  id: ProjectIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  slug: z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1).max(256),
  description: z.string().optional(),
  visibility: ProjectVisibilitySchema,
  repository: RepositoryInfoSchema,
  defaultBranch: z.string().default('main'),
  createdBy: z.string().min(1),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema.optional(),
  status: ProjectStatusSchema.default('active'),
  metadata: MetadataSchema,
});
export type Project = z.infer<typeof ProjectSchema>;
