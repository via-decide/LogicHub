import { zodToJsonSchema } from 'zod-to-json-schema';
import { DecisionSchema } from './decision.schema.js';

export const DecisionJsonSchema = zodToJsonSchema(DecisionSchema, {
  name: 'Decision',
  $refStrategy: 'none',
});
