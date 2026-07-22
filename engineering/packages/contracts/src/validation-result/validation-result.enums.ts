import { z } from 'zod';

export const ValidationTypeSchema = z.enum([
  'schema',
  'repository_integrity',
  'kicad_import',
  'erc',
  'drc',
  'bom',
  'constraint',
  'artifact_integrity',
  'merge_gate',
]);
export type ValidationType = z.infer<typeof ValidationTypeSchema>;

export const ValidationStatusSchema = z.enum([
  'pass',
  'warning',
  'fail',
  'error',
  'unknown',
  'skipped',
]);
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;
