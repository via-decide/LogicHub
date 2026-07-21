import { zodToJsonSchema } from 'zod-to-json-schema';
import { EngineeringObjectSchema } from './engineering-object.schema.js';

export const EngineeringObjectJsonSchema = zodToJsonSchema(EngineeringObjectSchema, {
  name: 'EngineeringObject',
  $refStrategy: 'none',
});
