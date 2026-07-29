import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProjectJsonSchema } from '../src/project/project.json-schema.js';
import { ArtifactJsonSchema } from '../src/artifact/artifact.json-schema.js';
import { EngineeringObjectJsonSchema } from '../src/engineering-object/engineering-object.json-schema.js';
import { ConstraintJsonSchema } from '../src/constraint/constraint.json-schema.js';
import { DecisionJsonSchema } from '../src/decision/decision.json-schema.js';
import { ValidationResultJsonSchema } from '../src/validation-result/validation-result.json-schema.js';
import { ModuleJsonSchema } from '../src/module/module.json-schema.js';
import { RevisionJsonSchema } from '../src/revision/revision.json-schema.js';
import { ChangeIntentJsonSchema } from '../src/change-intent/change-intent.json-schema.js';
import { EngineeringPullRequestJsonSchema } from '../src/engineering-pull-request/engineering-pull-request.json-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'generated');

mkdirSync(outDir, { recursive: true });

const schemas: Record<string, unknown> = {
  'project.schema.json': ProjectJsonSchema,
  'artifact.schema.json': ArtifactJsonSchema,
  'engineering-object.schema.json': EngineeringObjectJsonSchema,
  'constraint.schema.json': ConstraintJsonSchema,
  'decision.schema.json': DecisionJsonSchema,
  'validation-result.schema.json': ValidationResultJsonSchema,
  'module.schema.json': ModuleJsonSchema,
  'revision.schema.json': RevisionJsonSchema,
  'change-intent.schema.json': ChangeIntentJsonSchema,
  'engineering-pull-request.schema.json': EngineeringPullRequestJsonSchema,
};

for (const [filename, schema] of Object.entries(schemas)) {
  const path = resolve(outDir, filename);
  writeFileSync(path, JSON.stringify(schema, null, 2) + '\n');
  console.log(`  wrote ${filename}`);
}

console.log(`\nGenerated ${Object.keys(schemas).length} JSON Schema files in generated/`);
