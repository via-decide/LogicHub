import { zodToJsonSchema } from 'zod-to-json-schema';
import { ProjectSchema } from './project.schema.js';

export const ProjectJsonSchema = zodToJsonSchema(ProjectSchema, {
  name: 'Project',
  $refStrategy: 'none',
});
