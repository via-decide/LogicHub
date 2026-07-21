import { z } from 'zod';

export const ConstraintCategorySchema = z.enum([
  'electrical',
  'mechanical',
  'thermal',
  'manufacturing',
  'supply_chain',
  'cost',
  'reliability',
  'interface',
  'project_policy',
]);
export type ConstraintCategory = z.infer<typeof ConstraintCategorySchema>;

export const ConstraintSeveritySchema = z.enum(['info', 'warning', 'blocking']);
export type ConstraintSeverity = z.infer<typeof ConstraintSeveritySchema>;

export const ConstraintEvaluationSchema = z.enum([
  'pass',
  'warning',
  'violation',
  'unknown',
  'requires_validation',
  'error',
]);
export type ConstraintEvaluation = z.infer<typeof ConstraintEvaluationSchema>;
