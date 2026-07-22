import { zodToJsonSchema } from 'zod-to-json-schema';
import { OperationSchema } from './operation.schema.js';

export const OperationJsonSchema = zodToJsonSchema(OperationSchema, {
  name: 'Operation',
  $refStrategy: 'none',
});
