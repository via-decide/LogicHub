import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';

export const MaterialClassSchema = z.enum([
  'thermoplastic', 'thermoset', 'metal', 'ceramic', 'composite', 'elastomer', 'unknown',
]);
export type MaterialClass = z.infer<typeof MaterialClassSchema>;

export const PrintTechnologySchema = z.enum([
  'fdm', 'sla', 'sls', 'mjf', 'dmls', 'other',
]);
export type PrintTechnology = z.infer<typeof PrintTechnologySchema>;

export const MaterialProfileSchema = z.object({
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  name: z.string().min(1),
  materialClass: MaterialClassSchema,
  thermal: z.object({
    glassTransition: z.object({ value: z.number(), unit: z.literal('degC') }).optional(),
    heatDeflection: z.object({
      value: z.number(),
      unit: z.literal('degC'),
      load: z.object({ value: z.number(), unit: z.literal('MPa') }),
    }).optional(),
    maxServiceTemp: z.object({ value: z.number(), unit: z.literal('degC') }),
    thermalConductivity: z.object({
      value: z.number().positive(),
      unit: z.literal('W_per_mK'),
    }).optional(),
  }),
  mechanical: z.object({
    tensileStrength: z.object({ value: z.number().positive(), unit: z.literal('MPa') }).optional(),
    flexuralModulus: z.object({ value: z.number().positive(), unit: z.literal('MPa') }).optional(),
    impactStrength: z.object({ value: z.number().positive(), unit: z.literal('kJ_per_m2') }).optional(),
  }).optional(),
  print: z.object({
    technology: PrintTechnologySchema,
    layerAdhesionFactor: z.number().min(0).max(1).optional(),
    minimumWallThickness: z.object({ value: z.number().positive(), unit: z.literal('mm') }).optional(),
    recommendedPerimeters: z.number().int().positive().optional(),
  }).optional(),
  source: z.string().optional(),
});
export type MaterialProfile = z.infer<typeof MaterialProfileSchema>;
