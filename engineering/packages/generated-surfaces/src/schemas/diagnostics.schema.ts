import { z } from 'zod';

/**
 * The state of a single measurement taken during a self-test.
 *
 * UNKNOWN is a first-class outcome: a step that was skipped, could not be
 * performed, or produced no reading stays UNKNOWN. It is never folded into
 * ABSENT, and it never counts as a pass.
 */
export const ObservationStateSchema = z.enum(['PRESENT', 'ABSENT', 'UNKNOWN']);
export type ObservationState = z.infer<typeof ObservationStateSchema>;

export const MeasurementKindSchema = z.enum([
  'voltage', 'current', 'continuity', 'motion', 'response', 'reading',
]);
export type MeasurementKind = z.infer<typeof MeasurementKindSchema>;

export const SelfTestStepSchema = z.object({
  id: z.string().min(1),
  instruction: z.string().min(1),
  measures: MeasurementKindSchema,
  cautions: z.array(z.string()),
});
export type SelfTestStep = z.infer<typeof SelfTestStepSchema>;

export const SelfTestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  appliesToNodeType: z.string().min(1),
  steps: z.array(SelfTestStepSchema).min(1),
});
export type SelfTest = z.infer<typeof SelfTestSchema>;

export const ObservationSchema = z.object({
  stepId: z.string().min(1),
  state: ObservationStateSchema,
  /** Only meaningful when the state is PRESENT. */
  value: z.number().optional(),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const LikelihoodSchema = z.enum(['likely', 'possible', 'unlikely']);
export type Likelihood = z.infer<typeof LikelihoodSchema>;

export const PossibleCauseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  likelihood: LikelihoodSchema,
  /** The check that would separate this cause from the others. */
  nextCheck: z.string().min(1),
});
export type PossibleCause = z.infer<typeof PossibleCauseSchema>;

export const FaultCodeSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  appliesToNodeType: z.string().min(1),
  selfTestId: z.string().min(1),
});
export type FaultCode = z.infer<typeof FaultCodeSchema>;

export const DiagnosisSchema = z.object({
  faultCode: z.string().min(1),
  observations: z.array(ObservationSchema),
  /** Ranked, never narrowed to a single asserted cause. */
  possibleCauses: z.array(PossibleCauseSchema),
  /**
   * True when at least one step was not observed, so the diagnosis rests on
   * an incomplete test and must not be read as conclusive.
   */
  incomplete: z.boolean(),
  /** Steps that produced no observation, in stable order. */
  unobservedStepIds: z.array(z.string().min(1)),
  summary: z.string().min(1),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

export const MaintenanceEntrySchema = z.object({
  id: z.string().min(1),
  recordedAt: z.string().min(1),
  action: z.string().min(1),
  componentId: z.string().min(1).nullable(),
  evidenceRefs: z.array(z.string().min(1)),
});
export type MaintenanceEntry = z.infer<typeof MaintenanceEntrySchema>;
