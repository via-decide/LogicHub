import { zodToJsonSchema } from 'zod-to-json-schema';
import { RevisionSchema } from './revision.schema.js';

export const RevisionJsonSchema = zodToJsonSchema(RevisionSchema, {
  name: 'Revision',
  $refStrategy: 'none',
});
