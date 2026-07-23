import { z } from 'zod';
import { RuleResultStatusSchema } from './rule-result.schema.js';

/**
 * Versioned, self-documenting rule contract. Each rule module exports one of
 * these alongside its evaluate() function; `rule-kernel explain <id>` prints it.
 */
export const RuleDefinitionSchema = z.object({
  ruleId: z.string().min(1),
  ruleName: z.string().min(1),
  ruleVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  purpose: z.string().min(1),
  targetObjects: z.array(z.string()),
  requiredInputs: z.array(z.object({ name: z.string(), unit: z.string(), description: z.string() })),
  optionalInputs: z.array(z.object({ name: z.string(), unit: z.string(), description: z.string() })),
  formulas: z.array(z.object({ id: z.string(), expression: z.string(), description: z.string() })),
  deterministicProcedure: z.array(z.string()),
  assumptions: z.array(z.string()),
  thresholds: z.array(z.object({ name: z.string(), value: z.union([z.number(), z.string()]), unit: z.string().optional(), description: z.string() })),
  outputStates: z.array(RuleResultStatusSchema),
  confidenceRules: z.array(z.string()),
  evidenceRequirements: z.array(z.string()),
  failureModes: z.array(z.string()),
  requiredTestFixtureTypes: z.array(z.string()),
  physicalValidationProcedure: z.array(z.string()),
  limitations: z.array(z.string()),
});
export type RuleDefinition = z.infer<typeof RuleDefinitionSchema>;
