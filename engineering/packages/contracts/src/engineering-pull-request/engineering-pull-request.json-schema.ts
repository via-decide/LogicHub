import { zodToJsonSchema } from 'zod-to-json-schema';
import { EngineeringPullRequestSchema } from './engineering-pull-request.schema.js';

export const EngineeringPullRequestJsonSchema = zodToJsonSchema(EngineeringPullRequestSchema, {
  name: 'EngineeringPullRequest',
  $refStrategy: 'none',
});
