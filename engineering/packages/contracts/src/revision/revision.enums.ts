import { z } from 'zod';

export const RevisionStatusSchema = z.enum([
  'draft',
  'imported',
  'validating',
  'validated',
  'review',
  'merged',
  'rejected',
  'failed',
]);
export type RevisionStatus = z.infer<typeof RevisionStatusSchema>;
