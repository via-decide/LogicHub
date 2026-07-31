import { describe, it, expect } from 'vitest';
import { buildConversionJourney } from '../src/conversion/journey.js';
import { ConversionJourneySchema } from '../src/schemas/conversion.schema.js';
import { PLANS, getPlan, hasEntitlement, assertEntitled } from '../src/plans/tiers.js';
import {
  ACTIVE_PHASE,
  PHASE_POLICIES,
  activePhasePolicy,
  canSellKits,
  getPhasePolicy,
} from '../src/phase/phase-policy.js';
import { roverGraph } from './helpers.js';

describe('Gate 9 — conversion journey', () => {
  it('produces a schema-valid journey', () => {
    expect(ConversionJourneySchema.safeParse(buildConversionJourney(roverGraph())).success)
      .toBe(true);
  });

  it('carries product recommendation through to kit recommendation in one object', () => {
    // This is the gate: configuration to kit without leaving the project.
    const journey = buildConversionJourney(roverGraph());

    const rover = journey.productRecommendations.find(r => r.templateId === 'bluetooth-rover');
    const kit = journey.kitRecommendations.find(k => k.kitId === 'motion-starter');

    expect(rover?.verdict).toBe('CAN_MAKE');
    expect(kit?.complete).toBe(true);
    expect(kit?.matchPercentage).toBe(100);
    expect(journey.staysInProject).toBe(true);
  });

  it('ties every stage to the same graph', () => {
    const graph = roverGraph();
    expect(buildConversionJourney(graph).sourceGraphId).toBe(graph.id);
  });

  it('carries sourcing and validation state through to the commerce boundary', () => {
    // A high match percentage must not read as a purchasable kit.
    const journey = buildConversionJourney(roverGraph());
    const kit = journey.kitRecommendations.find(k => k.kitId === 'motion-starter')!;

    expect(kit.sourcingState).toBe('UNSOURCED');
    expect(kit.validationStatus).toBe('UNVALIDATED');
  });

  it('is deterministic', () => {
    const graph = roverGraph();
    const baseline = JSON.stringify(buildConversionJourney(graph, 'creator'));
    for (let i = 0; i < 5; i += 1) {
      expect(JSON.stringify(buildConversionJourney(graph, 'creator'))).toBe(baseline);
    }
  });
});

describe('Gate 9 — the offer fails closed', () => {
  const offer = buildConversionJourney(roverGraph()).offer;

  it('is not purchasable in the phase that holds no stock', () => {
    expect(offer.purchasable).toBe(false);
    expect(offer.phase).toBe(1);
    expect(offer.phaseName).toBe('No Inventory');
  });

  it('quotes no price, and says why rather than showing zero', () => {
    expect(offer.price.state).toBe('UNAVAILABLE');
    if (offer.price.state === 'UNAVAILABLE') {
      expect(offer.price.reason).toMatch(/no component carries a sourced supplier record/);
    }
  });

  it('blocks purchase and pricing, each with its reason', () => {
    const blocked = offer.blockedActions.map(b => b.action);
    expect(blocked).toContain('purchase-kit');
    expect(blocked).toContain('quote-price');
    for (const action of offer.blockedActions) {
      expect(action.reason.length).toBeGreaterThan(0);
    }
  });

  it('still offers everything that works locally', () => {
    expect(offer.availableActions).toContain('export-capsule-locally');
    expect(offer.availableActions).toContain('view-kit-manifest');
  });

  it('discloses that nothing is sourced, built, or certified', () => {
    const text = offer.disclosures.join(' ');
    expect(text).toMatch(/No component in this configuration has been sourced/);
    expect(text).toMatch(/has been assembled or measured/);
    expect(text).toMatch(/is certified/);
  });

  it('needs both stock and sourcing before a kit can be sold', () => {
    // Fixing one alone is not enough, so neither can be flipped in isolation.
    expect(canSellKits(1, true)).toBe(false);
    expect(canSellKits(2, false)).toBe(false);
    expect(canSellKits(2, true)).toBe(true);
  });
});

describe('Gate 9 — next steps', () => {
  it('marks local steps as local', () => {
    const steps = buildConversionJourney(roverGraph(), 'creator').nextSteps;
    const exportStep = steps.find(s => s.id === 'export-capsule')!;

    expect(exportStep.local).toBe(true);
    expect(exportStep.reason).toMatch(/nothing is uploaded/);
  });

  it('gates steps on the plan rather than silently hiding them', () => {
    const free = buildConversionJourney(roverGraph(), 'free').nextSteps;
    const creator = buildConversionJourney(roverGraph(), 'creator').nextSteps;

    expect(free.find(s => s.id === 'export-capsule')?.available).toBe(false);
    expect(creator.find(s => s.id === 'export-capsule')?.available).toBe(true);
  });

  it('marks ordering unavailable with the reason it is blocked', () => {
    const order = buildConversionJourney(roverGraph()).nextSteps.find(s => s.id === 'order-kit')!;
    expect(order.available).toBe(false);
    expect(order.local).toBe(false);
    expect(order.reason).toMatch(/holds no stock/);
  });
});

describe('Gate 9 — plans and phases', () => {
  it('defines the four funnel tiers', () => {
    expect(PLANS.map(p => p.tier)).toEqual(['free', 'creator', 'builder', 'professional']);
  });

  it('marks every price as proposed rather than live billing', () => {
    for (const plan of PLANS) {
      expect(plan.price.state).toBe('PROPOSED');
      expect(plan.price.currency).toBe('INR');
    }
  });

  it('widens entitlements as the tier rises', () => {
    const counts = PLANS.map(p => p.entitlements.length);
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i]).toBeGreaterThan(counts[i - 1]);
    }
  });

  it('keeps the engineering and service surfaces above the free tier', () => {
    expect(hasEntitlement('free', 'app.engineering')).toBe(false);
    expect(hasEntitlement('builder', 'app.engineering')).toBe(true);
    expect(hasEntitlement('free', 'repository.kicad')).toBe(false);
    expect(hasEntitlement('professional', 'repository.kicad')).toBe(true);
  });

  it('throws when a plan is asked for something it does not include', () => {
    expect(() => assertEntitled('free', 'manufacturing.handoff'))
      .toThrow(/free plan does not include/);
    expect(() => assertEntitled('professional', 'manufacturing.handoff')).not.toThrow();
  });

  it('rejects an unknown tier', () => {
    expect(() => getPlan('enterprise' as never)).toThrow(/Unknown plan tier/);
  });

  it('runs in phase 1 and leaves the later phases disabled', () => {
    expect(ACTIVE_PHASE).toBe(1);
    expect(activePhasePolicy().carriesInventory).toBe(false);

    for (const policy of PHASE_POLICIES.filter(p => p.phase !== 1)) {
      expect(policy.active, `phase ${policy.phase}`).toBe(false);
    }
  });

  it('says why the later phases are not enabled', () => {
    expect(getPhasePolicy(2).description).toMatch(/Not enabled/);
    expect(getPhasePolicy(3).description).toMatch(/Not enabled/);
    expect(getPhasePolicy(4).description).toMatch(/Not enabled/);
  });
});
