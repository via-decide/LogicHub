import { z } from 'zod';

export const EngineeringObjectTypeSchema = z.enum([
  'project',
  'schematic_sheet',
  'symbol',
  'component',
  'net',
  'pin',
  'interface',
  'pcb',
  'footprint',
  'pad',
  'track',
  'via',
  'zone',
  'layer',
  'board_outline',
  'bom_item',
  'test_point',
  'document',
  'firmware_interface',
  'module_instance',
]);
export type EngineeringObjectType = z.infer<typeof EngineeringObjectTypeSchema>;
