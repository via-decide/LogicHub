import { z } from 'zod';
import {
  AvailabilityStateSchema,
  CostEstimateSchema,
  PhysicalComponentSchema,
} from './component.schema.js';
import {
  AssemblyDifficultySchema,
  UpgradeOptionSchema,
  ValidationStatusSchema,
} from './kit.schema.js';

export const ResolvedComponentSchema = z.object({
  component: PhysicalComponentSchema,
  quantity: z.number().int().positive(),
  role: z.string().min(1),
  /** Graph node ids this component stands behind, in stable order. */
  coversNodeIds: z.array(z.string().min(1)),
});
export type ResolvedComponent = z.infer<typeof ResolvedComponentSchema>;

/**
 * An assumption the configuration makes that this kit does not hold up.
 * These are the reasons a match is not simply a percentage.
 */
export const IncompatibleAssumptionSchema = z.object({
  code: z.string().min(1),
  nodeId: z.string().min(1).nullable(),
  componentId: z.string().min(1).nullable(),
  message: z.string().min(1),
});
export type IncompatibleAssumption = z.infer<typeof IncompatibleAssumptionSchema>;

export const MissingComponentSchema = z.object({
  nodeId: z.string().min(1),
  nodeType: z.string().min(1),
  message: z.string().min(1),
});
export type MissingComponent = z.infer<typeof MissingComponentSchema>;

export const KitMatchSchema = z.object({
  kitId: z.string().min(1),
  kitName: z.string().min(1),
  /** Whole percent, 0-100. Integer so rankings never hinge on float noise. */
  matchPercentage: z.number().int().min(0).max(100),
  componentManifest: z.array(ResolvedComponentSchema),
  supportedProductTemplateIds: z.array(z.string().min(1)),
  missingComponents: z.array(MissingComponentSchema),
  /**
   * Units the kit carries that this configuration does not use. A kit that
   * covers the configuration exactly is a closer answer than a larger kit
   * that also covers it with parts left over.
   */
  surplusComponentCount: z.number().int().nonnegative(),
  incompatibleAssumptions: z.array(IncompatibleAssumptionSchema),
  estimatedTotalCost: CostEstimateSchema,
  supplierAvailability: AvailabilityStateSchema,
  assemblyDifficulty: AssemblyDifficultySchema,
  requiredTools: z.array(z.string().min(1)),
  firmwareSupport: z.boolean(),
  generatedAppSupport: z.boolean(),
  upgradePaths: z.array(UpgradeOptionSchema),
  validationStatus: ValidationStatusSchema,
  /**
   * True only when every graph node is covered, nothing is incompatible, and
   * the kit is therefore a complete answer to the configuration. It says
   * nothing about whether the kit can be bought or has ever been built.
   */
  complete: z.boolean(),
});
export type KitMatch = z.infer<typeof KitMatchSchema>;
