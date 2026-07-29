import { z } from 'zod';

export const VerificationSeveritySchema = z.enum(['error', 'warning']);
export type VerificationSeverity = z.infer<typeof VerificationSeveritySchema>;

export const VerificationFindingSchema = z.object({
  code: z.string().min(1),
  severity: VerificationSeveritySchema,
  path: z.string().min(1).nullable(),
  message: z.string().min(1),
});
export type VerificationFinding = z.infer<typeof VerificationFindingSchema>;

export const VerificationResultSchema = z.object({
  /**
   * True only when every check passed. A capsule that could not be fully
   * checked is not verified — there is no partial pass.
   */
  verified: z.boolean(),
  findings: z.array(VerificationFindingSchema),
  filesChecked: z.number().int().nonnegative(),
  /**
   * External references are recorded but cannot be checked from inside the
   * capsule, since their content is not carried here. They are reported as
   * unchecked rather than counted as passing.
   */
  externalReferencesUnchecked: z.number().int().nonnegative(),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;
