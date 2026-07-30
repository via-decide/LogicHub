import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/shared',
  'packages/contracts',
  'packages/persistence',
  'packages/artifact-store',
  'packages/git-adapter',
  'packages/kicad-adapter',
  'packages/repository-engine',
  'packages/validation-engine',
  'packages/product-graph',
  'packages/kit-matching',
  'packages/generated-surfaces',
  'packages/project-capsule',
  'packages/physical-loop',
  'packages/product-repository',
  'packages/commerce',
]);
