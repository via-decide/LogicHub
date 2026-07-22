import { zodToJsonSchema } from 'zod-to-json-schema';
import { MaterialProfileSchema } from './material-profile.schema.js';

export const MaterialProfileJsonSchema = zodToJsonSchema(MaterialProfileSchema, {
  name: 'MaterialProfile',
  $refStrategy: 'none',
});
