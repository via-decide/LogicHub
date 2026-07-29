import { z } from 'zod';
import {
  EngineeringObjectIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  ISODateTimeSchema,
  MetadataSchema,
  Sha256Schema,
  RelationshipTypeSchema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';
import { EngineeringObjectTypeSchema } from './engineering-object.enums.js';

export const ObjectRelationshipSchema = z.object({
  type: RelationshipTypeSchema,
  targetId: EngineeringObjectIdSchema,
  metadata: MetadataSchema,
});
export type ObjectRelationship = z.infer<typeof ObjectRelationshipSchema>;

export const EngineeringObjectSchema = z.object({
  id: EngineeringObjectIdSchema,
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  projectId: ProjectIdSchema,
  revisionId: RevisionIdSchema,
  objectType: EngineeringObjectTypeSchema,
  sourcePath: z.string().min(1),
  sourceObjectId: z.string().optional(),
  name: z.string().min(1),
  semanticKey: z.string().min(1),
  properties: z.record(z.string(), z.unknown()),
  relationships: z.array(ObjectRelationshipSchema),
  geometry: z.record(z.string(), z.unknown()).optional(),
  contentHash: Sha256Schema,
  semanticHash: Sha256Schema,
  createdAt: ISODateTimeSchema,
  metadata: MetadataSchema,
});
export type EngineeringObject = z.infer<typeof EngineeringObjectSchema>;
