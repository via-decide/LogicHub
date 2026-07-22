import { zodToJsonSchema } from 'zod-to-json-schema';
import { MechanicalManifestSchema } from './mechanical-manifest.schema.js';

export const MechanicalManifestJsonSchema = zodToJsonSchema(MechanicalManifestSchema, {
  name: 'MechanicalManifest',
  $refStrategy: 'none',
});
