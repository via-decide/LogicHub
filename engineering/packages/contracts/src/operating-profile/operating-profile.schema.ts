import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';

export const InstallationOrientationSchema = z.enum([
  'horizontal', 'vertical', 'inverted', 'wall_mounted', 'arbitrary',
]);
export type InstallationOrientation = z.infer<typeof InstallationOrientationSchema>;

export const EnvironmentTypeSchema = z.enum([
  'indoor', 'outdoor', 'sheltered_outdoor', 'industrial',
]);
export type EnvironmentType = z.infer<typeof EnvironmentTypeSchema>;

export const VentilationModeSchema = z.enum([
  'sealed', 'vented', 'forced_convection',
]);
export type VentilationMode = z.infer<typeof VentilationModeSchema>;

export const OperatingProfileSchema = z.object({
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  ambientTemperature: z.object({
    nominal: z.number(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    unit: z.literal('degC'),
  }),
  maxContinuousRuntime: z.object({
    value: z.number().positive(),
    unit: z.enum(['h', 'min', 's']),
  }),
  dutyCycle: z.object({
    value: z.number().min(0).max(1),
    unit: z.literal('fraction'),
    description: z.string().optional(),
  }).optional(),
  expectedLoad: z.object({
    description: z.string(),
    averagePower: z.object({ value: z.number(), unit: z.enum(['W', 'mW']) }).optional(),
    peakPower: z.object({ value: z.number(), unit: z.enum(['W', 'mW']) }).optional(),
  }).optional(),
  installationOrientation: InstallationOrientationSchema.default('horizontal'),
  environment: EnvironmentTypeSchema.default('indoor'),
  ventilation: VentilationModeSchema.default('sealed'),
});
export type OperatingProfile = z.infer<typeof OperatingProfileSchema>;
