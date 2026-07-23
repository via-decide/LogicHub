import { z } from 'zod';
import { QuantitySchema } from './quantity.schema.js';

/**
 * Structural contract for a frozen reference product (product.json).
 * Mirrors reference-products/sovereign-educational-console/product.schema.json.
 * Domain sections are passthrough objects — the per-rule input schemas are the
 * strict contracts; this schema enforces the freeze invariants.
 */
export const ReferenceProductSchema = z
  .object({
    schemaVersion: z.literal('0.1.0'),
    productId: z.string().min(1),
    productName: z.string().min(1),
    productRevision: z.string().regex(/^v\d+\.\d+$/),
    frozenAt: z.string().min(1),
    intendedAgeGroups: z.array(z.string()).min(1),
    intendedUseModel: z.string().min(1),
    intendedOperatingEnvironment: z.record(z.string(), z.unknown()),
    controller: z
      .object({
        frozenSelection: z
          .string()
          .min(1)
          .refine(v => !/\bor\b/i.test(v), {
            message: 'controller.frozenSelection must be a single frozen part, not an "A or B" ambiguity',
          }),
        rejectedAlternative: z.string().min(1),
        decisionRecord: z.string().min(1),
      })
      .passthrough(),
    power: z
      .object({
        battery: z.object({ nominalCapacity: QuantitySchema }).passthrough(),
        runtimeTarget: QuantitySchema,
      })
      .passthrough(),
    opticalTokenSystem: z
      .object({
        bayCount: z.number().int().positive(),
        classifier: z.string().min(1),
        explicitStates: z.array(z.string()).refine(
          s => s.includes('unknown') && s.includes('ambiguous'),
          { message: 'optical system must declare explicit unknown and ambiguous states' },
        ),
      })
      .passthrough(),
    humanInterface: z.object({ writingSlate: z.record(z.string(), z.unknown()) }).passthrough(),
    mechanical: z.object({ printEnvelope: z.record(z.string(), z.unknown()) }).passthrough(),
    daughterboardInterface: z
      .object({
        hotPlugSupported: z.literal(false),
      })
      .passthrough(),
    targets: z
      .object({
        unitCostExFactory: QuantitySchema,
        assemblyTime: QuantitySchema,
      })
      .passthrough(),
    knownExclusions: z.array(z.string()).min(1),
    safetyAssumptions: z.array(z.string()).min(1),
    unresolvedDecisions: z.array(z.string()),
  })
  .passthrough();
export type ReferenceProduct = z.infer<typeof ReferenceProductSchema>;
