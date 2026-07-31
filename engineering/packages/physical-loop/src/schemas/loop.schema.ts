import { z } from 'zod';
import { MeasurementSchema, ComparisonReportSchema } from './measurement.schema.js';

export const KitIdentitySchema = z.object({
  kitId: z.string().min(1),
  /** Identifies the individual unit, not the kit design. */
  unitSerial: z.string().min(1),
  /** Hardware revision of this physical unit. */
  hardwareRevision: z.string().min(1),
});
export type KitIdentity = z.infer<typeof KitIdentitySchema>;

export const ChecklistItemSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  /** Where this check came from, so it can be traced back to the kit. */
  sourceStep: z.number().int().nonnegative().nullable(),
  /** A check that must pass before power is applied. */
  blocking: z.boolean(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const ChecklistResponseSchema = z.enum(['PASS', 'FAIL', 'NOT_CHECKED']);
export type ChecklistResponse = z.infer<typeof ChecklistResponseSchema>;

export const ChecklistOutcomeSchema = z.object({
  /**
   * True only when every blocking item was explicitly passed. An unanswered
   * item blocks exactly as a failed one does: the checklist fails closed.
   */
  clearedForPower: z.boolean(),
  failedItemIds: z.array(z.string().min(1)),
  uncheckedItemIds: z.array(z.string().min(1)),
  summary: z.string().min(1),
});
export type ChecklistOutcome = z.infer<typeof ChecklistOutcomeSchema>;

/**
 * A record that firmware was flashed. This package does not flash anything —
 * it records an event someone else performed, and every field is attested by
 * whoever performed it.
 */
export const FlashRecordSchema = z.object({
  firmwareRevision: z.string().min(1),
  firmwareSha256: z.string().regex(/^[a-f0-9]{64}$/),
  target: z.string().min(1),
  flashedAt: z.string().min(1),
  flashedBy: z.string().min(1),
  /** Whether the flashed device was confirmed to respond afterwards. */
  verifiedResponding: z.boolean(),
});
export type FlashRecord = z.infer<typeof FlashRecordSchema>;

export const EvidenceKindSchema = z.enum(['photo', 'log', 'trace', 'note', 'video']);

export const EvidenceRecordSchema = z.object({
  ref: z.string().min(1),
  kind: EvidenceKindSchema,
  description: z.string().min(1),
  capturedAt: z.string().min(1),
  capturedBy: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export const UpgradeRecommendationSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1),
  /** Set when the recommendation follows from a specific measured gap. */
  drivenByQuantity: z.string().min(1).nullable(),
  upgradeOptionId: z.string().min(1).nullable(),
});
export type UpgradeRecommendation = z.infer<typeof UpgradeRecommendationSchema>;

/**
 * The saved outcome of one pass around the physical loop.
 *
 * A prototype revision is a record of what was actually done to a specific
 * unit. It carries the estimates it started from and the measurements that
 * tested them, side by side.
 */
export const PrototypeRevisionSchema = z.object({
  revisionId: z.string().min(1),
  identity: KitIdentitySchema,
  sourceGraphId: z.string().min(1),
  productGraphHash: z.string().regex(/^[a-f0-9]{64}$/),
  checklist: ChecklistOutcomeSchema,
  flash: FlashRecordSchema.nullable(),
  measurements: z.array(MeasurementSchema),
  comparison: ComparisonReportSchema,
  evidence: z.array(EvidenceRecordSchema),
  upgradeRecommendations: z.array(UpgradeRecommendationSchema),
  /**
   * Highest standing this revision has actually earned.
   *
   * UNVALIDATED  — nothing was measured.
   * PARTIAL      — some required quantities were measured.
   * CHARACTERISED — every required quantity was measured.
   *
   * There is deliberately no 'VERIFIED' or 'CERTIFIED' state. Measuring a
   * unit characterises that unit; it does not certify the design.
   */
  standing: z.enum(['UNVALIDATED', 'PARTIAL', 'CHARACTERISED']),
  savedAt: z.string().min(1),
});
export type PrototypeRevision = z.infer<typeof PrototypeRevisionSchema>;
