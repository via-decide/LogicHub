import { zodToJsonSchema } from 'zod-to-json-schema';
import { OperatingProfileSchema } from './operating-profile.schema.js';

export const OperatingProfileJsonSchema = zodToJsonSchema(OperatingProfileSchema, {
  name: 'OperatingProfile',
  $refStrategy: 'none',
});
