import { z } from 'zod';

export const EvidenceGradeSchema = z.enum(['verified', 'datasheet', 'measured', 'estimated', 'unknown']);

/** A physical/commercial quantity with explicit unit and optional provenance. */
export const QuantitySchema = z.object({
  value: z.number().finite(),
  unit: z.string().min(1),
  provenance: z.string().min(1).optional(),
  evidenceGrade: EvidenceGradeSchema.optional(),
});
export type QuantityInput = z.infer<typeof QuantitySchema>;

/**
 * A quantity slot that may be explicitly null (= not available). Absence is
 * data, never zero.
 */
export const OptionalQuantitySchema = QuantitySchema.nullable();

export const MissingInputSchema = z.object({
  field: z.string().min(1),
  reason: z.string().min(1),
});
