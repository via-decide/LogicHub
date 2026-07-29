import { zodToJsonSchema } from 'zod-to-json-schema';
import { ChangeIntentSchema } from './change-intent.schema.js';

export const ChangeIntentJsonSchema = zodToJsonSchema(ChangeIntentSchema, {
  name: 'ChangeIntent',
  $refStrategy: 'none',
});
