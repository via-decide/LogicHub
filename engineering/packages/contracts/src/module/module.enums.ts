import { z } from 'zod';

export const VerificationStatusSchema = z.enum([
  'unverified',
  'community',
  'reviewed',
  'validated',
  'deprecated',
  'revoked',
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
