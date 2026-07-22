import { zodToJsonSchema } from 'zod-to-json-schema';
import { ModuleSchema } from './module.schema.js';

export const ModuleJsonSchema = zodToJsonSchema(ModuleSchema, {
  name: 'Module',
  $refStrategy: 'none',
});
