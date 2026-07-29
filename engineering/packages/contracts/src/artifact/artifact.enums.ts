import { z } from 'zod';

export const ArtifactRoleSchema = z.enum([
  'source',
  'schematic_render',
  'pcb_render',
  'visual_diff',
  'structural_diff',
  'bom',
  'bom_diff',
  'erc_report',
  'drc_report',
  'constraint_report',
  'validation_report',
  'decision_export',
  'revision_manifest',
  'review_report',
]);
export type ArtifactRole = z.infer<typeof ArtifactRoleSchema>;
