import { z } from 'zod';
import {
  RevisionIdSchema,
  ProjectIdSchema,
  ISODateTimeSchema,
  MetadataSchema,
  Sha256Schema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';
import { RevisionStatusSchema } from './revision.enums.js';

export const RevisionSchema = z.object({
  id: RevisionIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  projectId: ProjectIdSchema,
  gitCommitSha: z.string().regex(/^[a-f0-9]{40}$/),
  branchName: z.string().min(1),
  parentRevisionIds: z.array(RevisionIdSchema),
  author: z.string().min(1),
  message: z.string(),
  createdAt: ISODateTimeSchema,
  snapshotHash: Sha256Schema.optional(),
  engineeringObjectSnapshotHash: Sha256Schema.optional(),
  constraintSnapshotHash: Sha256Schema.optional(),
  decisionSnapshotHash: Sha256Schema.optional(),
  bomSnapshotHash: Sha256Schema.optional(),
  artifactManifestHash: Sha256Schema.optional(),
  toolchain: z.record(z.string(), z.string()),
  status: RevisionStatusSchema.default('draft'),
  metadata: MetadataSchema,
});
export type Revision = z.infer<typeof RevisionSchema>;
