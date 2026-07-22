import { z } from 'zod';

export const ChangeIntentStatusSchema = z.enum([
  'captured',
  'planned',
  'executing',
  'generated',
  'validating',
  'validated',
  'review',
  'accepted',
  'rejected',
  'failed',
  'cancelled',
]);
export type ChangeIntentStatus = z.infer<typeof ChangeIntentStatusSchema>;
