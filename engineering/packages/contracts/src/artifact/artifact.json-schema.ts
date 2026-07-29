import { zodToJsonSchema } from 'zod-to-json-schema';
import { ArtifactSchema } from './artifact.schema.js';

export const ArtifactJsonSchema = zodToJsonSchema(ArtifactSchema, {
  name: 'Artifact',
  $refStrategy: 'none',
});
