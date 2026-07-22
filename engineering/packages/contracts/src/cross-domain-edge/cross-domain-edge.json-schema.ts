import { zodToJsonSchema } from 'zod-to-json-schema';
import { CrossDomainEdgeSchema } from './cross-domain-edge.schema.js';

export const CrossDomainEdgeJsonSchema = zodToJsonSchema(CrossDomainEdgeSchema, {
  name: 'CrossDomainEdge',
  $refStrategy: 'none',
});
