import { z } from 'zod';

/**
 * The quantities the Motion Starter loop asks for. A quantity that is not
 * measured stays not measured; there is no default value for any of these.
 */
export const MeasuredQuantitySchema = z.enum([
  'battery.voltage',
  'idle.current',
  'motor.current',
  'motor.peakCurrent',
  'runtime',
  'bluetooth.range',
  'motor.response',
  'sensor.detectionRange',
]);
export type MeasuredQuantity = z.infer<typeof MeasuredQuantitySchema>;

export const EnvironmentalConditionsSchema = z.object({
  ambientTemperatureC: z.number().nullable(),
  surface: z.string().nullable(),
  notes: z.string(),
});
export type EnvironmentalConditions = z.infer<typeof EnvironmentalConditionsSchema>;

/**
 * A value read off real hardware.
 *
 * Every field that establishes provenance is required: who took it, with
 * what, when, on which hardware and firmware, and against what evidence. A
 * reading without provenance is not a measurement, and this package never
 * constructs one on a user's behalf — measurements only ever enter from
 * outside.
 */
export const MeasurementSchema = z.object({
  id: z.string().min(1),
  quantity: MeasuredQuantitySchema,
  value: z.number(),
  unit: z.string().min(1),
  /** Node the reading was taken at, when it applies to one. */
  nodeId: z.string().min(1).nullable(),
  recordedAt: z.string().min(1),
  recordedBy: z.string().min(1),
  instrument: z.string().min(1),
  environment: EnvironmentalConditionsSchema,
  evidenceRef: z.string().min(1),
  /** Serial of the individual physical unit this reading came from. */
  unitSerial: z.string().min(1),
  hardwareRevision: z.string().min(1),
  firmwareRevision: z.string().min(1),
});
export type Measurement = z.infer<typeof MeasurementSchema>;

/**
 * How a value came to be known. These never overwrite one another: a
 * measurement is recorded alongside the estimate it tests, so the two can be
 * compared rather than one quietly replacing the other.
 */
export const ValueSourceSchema = z.enum(['ESTIMATED', 'SIMULATED', 'MEASURED']);
export type ValueSource = z.infer<typeof ValueSourceSchema>;

export const ComparisonStateSchema = z.enum([
  /** Both an estimate and a measurement exist and were compared. */
  'COMPARED',
  /** An estimate exists but nothing has been measured yet. */
  'NOT_MEASURED',
  /** A measurement exists but the graph offers nothing to compare it against. */
  'NO_ESTIMATE',
  /** Neither side is available. */
  'UNKNOWN',
]);
export type ComparisonState = z.infer<typeof ComparisonStateSchema>;

export const QuantityComparisonSchema = z.object({
  quantity: MeasuredQuantitySchema,
  unit: z.string(),
  state: ComparisonStateSchema,
  /** Present only when the graph derived one. Never defaulted to zero. */
  estimated: z.number().optional(),
  /** Present only when a simulation actually ran. None do in this release. */
  simulated: z.number().optional(),
  /** Present only when a real reading was recorded. */
  measured: z.number().optional(),
  /** measured - estimated, only when both exist. */
  difference: z.number().optional(),
  percentDifference: z.number().optional(),
  measurementId: z.string().min(1).nullable(),
  evidenceRef: z.string().min(1).nullable(),
  note: z.string(),
});
export type QuantityComparison = z.infer<typeof QuantityComparisonSchema>;

export const ComparisonReportSchema = z.object({
  comparisons: z.array(QuantityComparisonSchema),
  /** Quantities the loop asks for that have not been measured, in stable order. */
  unmeasuredQuantities: z.array(MeasuredQuantitySchema),
  /**
   * True only when every required quantity has been measured. A partial set
   * is never reported as a completed characterisation.
   */
  complete: z.boolean(),
  summary: z.string().min(1),
});
export type ComparisonReport = z.infer<typeof ComparisonReportSchema>;
