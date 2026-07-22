import { zodToJsonSchema } from 'zod-to-json-schema';
import { ValidationResultSchema } from './validation-result.schema.js';

export const ValidationResultJsonSchema = zodToJsonSchema(ValidationResultSchema, {
  name: 'ValidationResult',
  $refStrategy: 'none',
});
