import { z } from 'zod';

export const PRStatusSchema = z.enum([
  'draft',
  'open',
  'changes_requested',
  'approved',
  'merged',
  'closed',
  'rejected',
]);
export type PRStatus = z.infer<typeof PRStatusSchema>;

export const ReviewDecisionSchema = z.enum(['comment', 'approve', 'request_changes']);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
