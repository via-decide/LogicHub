import { z } from 'zod';
import {
  ArtifactIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  ISODateTimeSchema,
  MetadataSchema,
  Sha256Schema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';
import { ArtifactRoleSchema } from './artifact.enums.js';

export const ArtifactSchema = z.object({
  id: ArtifactIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  projectId: ProjectIdSchema,
  revisionId: RevisionIdSchema,
  role: ArtifactRoleSchema,
  filename: z.string().min(1),
  mediaType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  sha256: Sha256Schema,
  storageKey: z.string().min(1),
  sourcePaths: z.array(z.string()),
  generatedBy: z.string().optional(),
  generatorVersion: z.string().optional(),
  createdAt: ISODateTimeSchema,
  provenance: z.record(z.string(), z.unknown()).optional(),
  metadata: MetadataSchema,
});
export type Artifact = z.infer<typeof ArtifactSchema>;
