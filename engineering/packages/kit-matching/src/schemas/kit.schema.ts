import { z } from 'zod';

/**
 * How far a kit has actually been taken.
 *
 * UNVALIDATED     — exists on paper only.
 * SIMULATED       — arithmetic and models agree; nothing has been built.
 * BENCH_TESTED    — assembled and measured on a bench, with evidence recorded.
 * FIELD_VALIDATED — used in its intended setting, with evidence recorded.
 *
 * A kit can only advance past UNVALIDATED when the corresponding physical
 * evidence exists. A simulation never counts as validation.
 */
export const ValidationStatusSchema = z.enum([
  'UNVALIDATED',
  'SIMULATED',
  'BENCH_TESTED',
  'FIELD_VALIDATED',
]);
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;

export const AssemblyDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type AssemblyDifficulty = z.infer<typeof AssemblyDifficultySchema>;

export const KitComponentRefSchema = z.object({
  componentId: z.string().min(1),
  quantity: z.number().int().positive(),
  /** What this part does in this kit, e.g. "left drive motor". */
  role: z.string().min(1),
});
export type KitComponentRef = z.infer<typeof KitComponentRefSchema>;

export const AssemblyStepSchema = z.object({
  order: z.number().int().positive(),
  instruction: z.string().min(1),
  /** Anything that can go wrong or cause harm at this step. */
  cautions: z.array(z.string()),
});
export type AssemblyStep = z.infer<typeof AssemblyStepSchema>;

export const TestStepSchema = z.object({
  order: z.number().int().positive(),
  check: z.string().min(1),
  /** What a pass looks like. An unrun check is never a pass. */
  expected: z.string().min(1),
});
export type TestStep = z.infer<typeof TestStepSchema>;

export const UpgradeOptionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  replacesComponentId: z.string().min(1).nullable(),
  withComponentId: z.string().min(1),
  /**
   * Swapping a part invalidates the compatibility evaluation that was done
   * for the part it replaces; the graph must be recalculated afterwards.
   */
  requiresRecalculation: z.literal(true),
});
export type UpgradeOption = z.infer<typeof UpgradeOptionSchema>;

export const PhysicalKitDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  components: z.array(KitComponentRefSchema).min(1),
  supportedProductTemplateIds: z.array(z.string().min(1)),
  requiredTools: z.array(z.string().min(1)),
  assemblySteps: z.array(AssemblyStepSchema),
  testProcedure: z.array(TestStepSchema),
  upgradeOptions: z.array(UpgradeOptionSchema),
  firmwareTarget: z.string().min(1),
  assemblyDifficulty: AssemblyDifficultySchema,
  validationStatus: ValidationStatusSchema,
});
export type PhysicalKitDefinition = z.infer<typeof PhysicalKitDefinitionSchema>;
