import { z } from 'zod';

export const MatchVerdictSchema = z.enum(['CAN_MAKE', 'ALMOST_POSSIBLE', 'NOT_RECOMMENDED']);
export type MatchVerdict = z.infer<typeof MatchVerdictSchema>;

export const CapabilityOperatorSchema = z.enum(['gte', 'lte', 'eq', 'exists']);

export const CapabilityRequirementSchema = z.object({
  capability: z.string().min(1),
  operator: CapabilityOperatorSchema,
  value: z.union([z.number(), z.boolean()]),
  weight: z.number().min(0).max(1),
  required: z.boolean(),
});
export type CapabilityRequirement = z.infer<typeof CapabilityRequirementSchema>;

export const ProductTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  requiredCapabilities: z.array(CapabilityRequirementSchema),
  optionalCapabilities: z.array(CapabilityRequirementSchema),
});
export type ProductTemplate = z.infer<typeof ProductTemplateSchema>;

export const MatchResultSchema = z.object({
  templateId: z.string().min(1),
  templateName: z.string().min(1),
  verdict: MatchVerdictSchema,
  score: z.number().min(0).max(1),
  matchedCapabilities: z.array(z.string()),
  missingCapabilities: z.array(z.string()),
  suggestedChanges: z.array(z.string()),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;
