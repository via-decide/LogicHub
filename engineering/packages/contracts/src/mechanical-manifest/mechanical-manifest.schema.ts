import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION, Sha256Schema } from '@logichub-engineering/shared';

export const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Vector3 = z.infer<typeof Vector3Schema>;

export const EnclosureSchema = z.object({
  materialName: z.string().min(1),
  internalVolume: z.object({ value: z.number().positive(), unit: z.literal('cm3') }),
  wallThickness: z.object({ value: z.number().positive(), unit: z.literal('mm') }),
  ventArea: z.object({ value: z.number().nonnegative(), unit: z.literal('mm2') }).optional(),
  estimatedThermalResistance: z.object({
    value: z.number().positive(),
    unit: z.literal('K_per_W'),
  }).optional(),
  printOrientation: Vector3Schema.optional(),
});
export type Enclosure = z.infer<typeof EnclosureSchema>;

export const ConnectorFamilySchema = z.enum([
  'jst_xh', 'jst_ph', 'molex_kk', 'molex_microfit',
  'dupont', 'usb_a', 'usb_c', 'barrel_jack',
  'screw_terminal', 'db9', 'db25', 'rj45', 'rj11',
  'header_254', 'header_127', 'fpc', 'other',
]);
export type ConnectorFamily = z.infer<typeof ConnectorFamilySchema>;

export const PinAssignmentSchema = z.object({
  pin: z.number().int().positive(),
  net: z.string().min(1),
  description: z.string().optional(),
});
export type PinAssignment = z.infer<typeof PinAssignmentSchema>;

export const ConnectorSchema = z.object({
  id: z.string().min(1),
  designator: z.string().min(1),
  family: ConnectorFamilySchema,
  pinCount: z.number().int().positive(),
  pinMap: z.array(PinAssignmentSchema).optional(),
  matingOrientation: Vector3Schema.optional(),
  insertionDirection: Vector3Schema.optional(),
  clearanceRequired: z.object({ value: z.number().nonnegative(), unit: z.literal('mm') }).optional(),
  pcbFootprintRef: z.string().optional(),
});
export type Connector = z.infer<typeof ConnectorSchema>;

export const FastenerTypeSchema = z.enum([
  'self_tapping', 'heat_set_insert', 'press_fit', 'snap_fit',
  'threaded_boss', 'adhesive', 'other',
]);
export type FastenerType = z.infer<typeof FastenerTypeSchema>;

export const FastenerSchema = z.object({
  id: z.string().min(1),
  type: FastenerTypeSchema,
  bossOuterDiameter: z.object({ value: z.number().positive(), unit: z.literal('mm') }).optional(),
  bossInnerDiameter: z.object({ value: z.number().positive(), unit: z.literal('mm') }).optional(),
  bossDepth: z.object({ value: z.number().positive(), unit: z.literal('mm') }).optional(),
  insertSpec: z.string().optional(),
  recommendedTorque: z.object({ value: z.number().positive(), unit: z.literal('Nm') }).optional(),
  loadVector: Vector3Schema.optional(),
  printLayerNormal: Vector3Schema.optional(),
  perimeters: z.number().int().positive().optional(),
});
export type Fastener = z.infer<typeof FastenerSchema>;

export const EvidenceRefSchema = z.object({
  artifactHash: Sha256Schema,
  description: z.string().min(1),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const MechanicalManifestSchema = z.object({
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  enclosure: EnclosureSchema.optional(),
  connectors: z.array(ConnectorSchema).default([]),
  fasteners: z.array(FastenerSchema).default([]),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
});
export type MechanicalManifest = z.infer<typeof MechanicalManifestSchema>;
