import { z } from 'zod';

/**
 * The four commerce phases. Only one is active in this build; the rest are
 * declared so the roadmap is visible, not so they can be switched on.
 */
export const CommercePhaseSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4),
]);
export type CommercePhase = z.infer<typeof CommercePhaseSchema>;

export const PlanTierSchema = z.enum(['free', 'creator', 'builder', 'professional']);
export type PlanTier = z.infer<typeof PlanTierSchema>;

export const EntitlementSchema = z.enum([
  'nodes.basic',
  'mode.explore',
  'discovery.products',
  'app.demo',
  'project.saves.limited',
  'graph.complete',
  'app.operator',
  'capsule.export',
  'firmware.specification',
  'report.recommendation',
  'components.real',
  'repository.hardware',
  'revisions.multiple',
  'firmware.generation',
  'app.engineering',
  'app.service',
  'validation.packs',
  'repository.kicad',
  'diff.semantic',
  'evidence.capture',
  'collaboration',
  'manufacturing.handoff',
]);
export type Entitlement = z.infer<typeof EntitlementSchema>;

/**
 * A plan's list price, as configured by whoever runs the platform.
 *
 * This is a proposal recorded from the product plan, not a live billing
 * figure and not a price anyone has been charged. `state` says so explicitly
 * so a caller cannot mistake it for a quote from a payment system.
 */
export const PlanPriceSchema = z.object({
  state: z.literal('PROPOSED'),
  currency: z.literal('INR'),
  minimum: z.number().nonnegative(),
  /** Null where the tier is open-ended, e.g. "9,999+". */
  maximum: z.number().nonnegative().nullable(),
  period: z.enum(['per-project', 'per-month', 'none']),
});
export type PlanPrice = z.infer<typeof PlanPriceSchema>;

export const PlanSchema = z.object({
  tier: PlanTierSchema,
  name: z.string().min(1),
  price: PlanPriceSchema,
  entitlements: z.array(EntitlementSchema),
});
export type Plan = z.infer<typeof PlanSchema>;

/**
 * What a purchase would cost.
 *
 * Modelled as a tagged union so an unavailable quote cannot be read as a
 * price of zero. Nothing in this build can produce a QUOTED value, because no
 * component has been sourced.
 */
export const PriceQuoteSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('UNAVAILABLE'),
    reason: z.string().min(1),
  }),
  z.object({
    state: z.literal('QUOTED'),
    currency: z.string().length(3),
    amount: z.number().nonnegative(),
    quotedAt: z.string().min(1),
    sourceRef: z.string().min(1),
  }),
]);
export type PriceQuote = z.infer<typeof PriceQuoteSchema>;
