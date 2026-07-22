import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/shared',
  'packages/contracts',
  'packages/persistence',
  'packages/artifact-store',
  'packages/git-adapter',
  'packages/kicad-adapter',
]);
