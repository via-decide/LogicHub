import { z } from 'zod';

export const RelationshipTypeSchema = z.enum([
  'contains',
  'depends_on',
  'connects_to',
  'powered_by',
  'implemented_by',
  'constrained_by',
  'validated_by',
  'represented_by',
  'replaces',
  'derived_from',
  'supplied_by',
  'instantiates',
  'supersedes',
]);
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;
