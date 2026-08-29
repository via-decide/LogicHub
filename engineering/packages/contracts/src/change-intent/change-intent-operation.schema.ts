import { z } from 'zod';

/**
 * These shapes deliberately mirror repository-engine's ReplayOperation and
 * DeltaRecord (see @logichub-engineering/repository-engine `semdiff/types.ts`).
 * contracts cannot depend on repository-engine (repository-engine already
 * depends on contracts), so the fields are re-declared here rather than
 * imported — but field names/semantics must stay in lockstep so a
 * ChangeIntent can be diffed against a real SemDiffResult without a second,
 * disconnected vocabulary. `deltaType` / `domain` accept any string rather
 * than a literal union so this package does not need to track every value
 * repository-engine's DeltaType/DeltaDomain unions add over time.
 */

export const RequestedOperationKindSchema = z.enum(['add', 'remove', 'replace', 'move']);
export type RequestedOperationKind = z.infer<typeof RequestedOperationKindSchema>;

export const RequestedOperationSchema = z.object({
  operation: RequestedOperationKindSchema,
  objectId: z.string().min(1),
  expectedOldHash: z.string().nullable().optional(),
  expectedAbsent: z.boolean().optional(),
  newObject: z
    .object({
      semanticId: z.string().min(1),
      semanticHash: z.string().min(1),
    })
    .optional(),
  oldObjectId: z.string().min(1).optional(),
  newObjectId: z.string().min(1).optional(),
  expectedBodyHash: z.string().optional(),
});
export type RequestedOperation = z.infer<typeof RequestedOperationSchema>;

export const ExpectedObjectChangeSchema = z.object({
  deltaType: z.string().min(1),
  domain: z.string().min(1),
  oldSemanticId: z.string().nullable().optional(),
  newSemanticId: z.string().nullable().optional(),
  description: z.string().optional(),
});
export type ExpectedObjectChange = z.infer<typeof ExpectedObjectChangeSchema>;

export const ChangeIntentConstraintRefSchema = z.object({
  constraintId: z.string().min(1),
  mustHold: z.boolean().default(true),
  note: z.string().optional(),
});
export type ChangeIntentConstraintRef = z.infer<typeof ChangeIntentConstraintRefSchema>;
