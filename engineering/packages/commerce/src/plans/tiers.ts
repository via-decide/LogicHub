import type { Entitlement, Plan, PlanTier } from '../schemas/commerce.schema.js';

/**
 * The commercial funnel.
 *
 * Prices are transcribed from the product plan and are marked PROPOSED. No
 * billing system stands behind them, nobody has been charged them, and they
 * must not be presented as live pricing.
 */
export const PLANS: readonly Plan[] = [
  {
    tier: 'free',
    name: 'Free',
    price: { state: 'PROPOSED', currency: 'INR', minimum: 0, maximum: 0, period: 'none' },
    entitlements: [
      'nodes.basic',
      'mode.explore',
      'discovery.products',
      'app.demo',
      'project.saves.limited',
    ],
  },
  {
    tier: 'creator',
    name: 'Creator',
    price: {
      state: 'PROPOSED', currency: 'INR', minimum: 499, maximum: 999, period: 'per-project',
    },
    entitlements: [
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
    ],
  },
  {
    tier: 'builder',
    name: 'Builder',
    price: {
      state: 'PROPOSED', currency: 'INR', minimum: 1499, maximum: 4999, period: 'per-month',
    },
    entitlements: [
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
    ],
  },
  {
    tier: 'professional',
    name: 'Professional',
    price: {
      state: 'PROPOSED', currency: 'INR', minimum: 9999, maximum: null, period: 'per-month',
    },
    entitlements: [
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
    ],
  },
];

const BY_TIER = new Map(PLANS.map(p => [p.tier, p]));

export function getPlan(tier: PlanTier): Plan {
  const plan = BY_TIER.get(tier);
  if (!plan) throw new Error(`Unknown plan tier: ${tier}`);
  return plan;
}

export function hasEntitlement(tier: PlanTier, entitlement: Entitlement): boolean {
  return getPlan(tier).entitlements.includes(entitlement);
}

/**
 * Guard used where a feature is about to be offered. An entitlement a tier
 * does not hold is a programming error, not something to render greyed out.
 */
export function assertEntitled(tier: PlanTier, entitlement: Entitlement): void {
  if (!hasEntitlement(tier, entitlement)) {
    throw new Error(`The ${tier} plan does not include ${entitlement}.`);
  }
}
