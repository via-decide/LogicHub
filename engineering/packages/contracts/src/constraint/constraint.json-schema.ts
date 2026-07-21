import { zodToJsonSchema } from 'zod-to-json-schema';
import { ConstraintSchema } from './constraint.schema.js';

export const ConstraintJsonSchema = zodToJsonSchema(ConstraintSchema, {
  name: 'Constraint',
  $refStrategy: 'none',
});
