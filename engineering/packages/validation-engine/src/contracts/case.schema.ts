import { z } from 'zod';
import { EvaluationIntentSchema } from './evaluation-input.schema.js';
import { RuleResultStatusSchema } from './rule-result.schema.js';
import {
  PowerThermalInputsSchema,
  OpticalClassificationInputsSchema,
  InterfaceIntegrityInputsSchema,
  MechanicalRuggednessInputsSchema,
  ManufacturingEconomicsInputsSchema,
} from './rule-inputs.schema.js';

export const RULE_IDS = [
  'SEC-POWER-THERMAL-001',
  'SEC-OPTICAL-CLASSIFICATION-001',
  'SEC-INTERFACE-INTEGRITY-001',
  'SEC-MECHANICAL-RUGGEDNESS-001',
  'SEC-MANUFACTURING-ECONOMICS-001',
] as const;
export const RuleIdSchema = z.enum(RULE_IDS);
export type RuleId = z.infer<typeof RuleIdSchema>;

/**
 * A normalized product case: one evaluation intent plus per-rule inputs.
 * Fixtures additionally declare the expected status per rule.
 */
export const ProductCaseSchema = z.object({
  schemaVersion: z.literal('0.1.0'),
  caseId: z.string().min(1),
  description: z.string().min(1),
  /** 'synthetic' fixtures are NEVER counted as historical evidence */
  provenanceClass: z.enum(['reference', 'synthetic', 'historical']),
  intent: EvaluationIntentSchema,
  rules: z.union([z.literal('all'), z.array(RuleIdSchema).min(1)]),
  inputs: z.object({
    power: PowerThermalInputsSchema.optional(),
    optical: OpticalClassificationInputsSchema.optional(),
    interface: InterfaceIntegrityInputsSchema.optional(),
    mechanical: MechanicalRuggednessInputsSchema.optional(),
    economics: ManufacturingEconomicsInputsSchema.optional(),
  }),
  /** fixture expectations (test-only; ignored by the evaluator) */
  expected: z.record(z.string(), RuleResultStatusSchema).optional(),
});
export type ProductCase = z.infer<typeof ProductCaseSchema>;
