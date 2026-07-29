import { z } from 'zod';

export const ComponentFamilySchema = z.enum([
  'controller',
  'motor-driver',
  'motor',
  'battery',
  'sensor',
  'connectivity',
  'display',
  'input',
  'output',
  'actuator',
  'mechanical',
  'wiring',
  'enclosure',
]);
export type ComponentFamily = z.infer<typeof ComponentFamilySchema>;

/**
 * How much is actually known about where a component comes from.
 *
 * UNSOURCED  — a generic part family is named, but no manufacturer part
 *              number, supplier, price or stock record has been attached.
 * SOURCED    — a specific supplier record exists and is recorded below.
 * VERIFIED   — the sourced record has been confirmed against the supplier.
 *
 * A component starts UNSOURCED. Naming a virtual node never advances this:
 * a virtual node is not proof that a compatible physical part was selected.
 */
export const SourcingStateSchema = z.enum(['UNSOURCED', 'SOURCED', 'VERIFIED']);
export type SourcingState = z.infer<typeof SourcingStateSchema>;

export const AvailabilityStateSchema = z.enum([
  'UNKNOWN',
  'IN_STOCK',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'DISCONTINUED',
]);
export type AvailabilityState = z.infer<typeof AvailabilityStateSchema>;

/**
 * Cost is a tagged union rather than a nullable number, so an unpriced part
 * cannot be silently summed as zero. A total is only ever a number when every
 * contributing part carries a sourced price.
 */
export const CostEstimateSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('UNKNOWN'),
    reason: z.string().min(1),
  }),
  z.object({
    state: z.literal('KNOWN'),
    currency: z.string().length(3),
    amount: z.number().nonnegative(),
    sourcedAt: z.string().min(1),
    sourceRef: z.string().min(1),
  }),
]);
export type CostEstimate = z.infer<typeof CostEstimateSchema>;

export const UNKNOWN_COST: CostEstimate = {
  state: 'UNKNOWN',
  reason: 'No supplier price has been sourced for this component.',
};

/**
 * Where an electrical envelope came from.
 *
 * GENERIC_FAMILY — typical figures for the part family, used for feasibility
 *                  arithmetic. Not a measurement, and not read from the
 *                  datasheet of any one specific part.
 * DATASHEET      — transcribed from a named datasheet revision.
 * MEASURED       — measured on real hardware and recorded as evidence.
 */
export const EnvelopeSourceSchema = z.enum(['GENERIC_FAMILY', 'DATASHEET', 'MEASURED']);
export type EnvelopeSource = z.infer<typeof EnvelopeSourceSchema>;

export const ElectricalEnvelopeSchema = z.object({
  supplyVoltageMinV: z.number().positive(),
  supplyVoltageMaxV: z.number().positive(),
  typicalCurrentMa: z.number().nonnegative(),
  envelopeSource: EnvelopeSourceSchema,
});
export type ElectricalEnvelope = z.infer<typeof ElectricalEnvelopeSchema>;

export const SourcingRecordSchema = z.object({
  state: SourcingStateSchema,
  /** Null until a specific part has genuinely been chosen and recorded. */
  manufacturerPartNumber: z.string().min(1).nullable(),
  supplierSku: z.string().min(1).nullable(),
  cost: CostEstimateSchema,
  availability: AvailabilityStateSchema,
});
export type SourcingRecord = z.infer<typeof SourcingRecordSchema>;

export const PhysicalComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  family: ComponentFamilySchema,
  /**
   * Generic part-family designation where one exists and is widely used
   * (for example "ESP32" or "TB6612FNG"). This names a family, not a
   * purchasable part, and never stands in for a part number.
   */
  partFamily: z.string().min(1).nullable(),
  /** Which ProductGraph node type this component can stand behind, if any. */
  satisfiesNodeType: z.string().min(1).nullable(),
  electrical: ElectricalEnvelopeSchema.nullable(),
  providesCapabilities: z.record(z.string(), z.unknown()),
  sourcing: SourcingRecordSchema,
  notes: z.string(),
});
export type PhysicalComponent = z.infer<typeof PhysicalComponentSchema>;
