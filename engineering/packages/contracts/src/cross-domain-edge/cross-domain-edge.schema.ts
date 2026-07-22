import { z } from 'zod';
import {
  EngineeringObjectIdSchema,
  RevisionIdSchema,
  CURRENT_SCHEMA_VERSION,
} from '@logichub-engineering/shared';

export const EngineeringDomainSchema = z.enum([
  'electrical',
  'mechanical',
  'firmware',
  'thermal',
]);
export type EngineeringDomain = z.infer<typeof EngineeringDomainSchema>;

export const CrossDomainEdgeTypeSchema = z.enum([
  'dissipates_into',
  'mounts_to',
  'mates_with',
  'routes_through',
  'fastens_to',
  'shields',
  'conducts_heat',
  'constrains_clearance',
]);
export type CrossDomainEdgeType = z.infer<typeof CrossDomainEdgeTypeSchema>;

export const CrossDomainEdgeSchema = z.object({
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  revisionId: RevisionIdSchema,
  edgeType: CrossDomainEdgeTypeSchema,
  sourceDomain: EngineeringDomainSchema,
  targetDomain: EngineeringDomainSchema,
  sourceObjectId: EngineeringObjectIdSchema.optional(),
  targetObjectId: EngineeringObjectIdSchema.optional(),
  sourceRef: z.string().min(1),
  targetRef: z.string().min(1),
  properties: z.record(z.string(), z.unknown()).optional(),
});
export type CrossDomainEdge = z.infer<typeof CrossDomainEdgeSchema>;
