import type { ProductGraph } from '@logichub-engineering/product-graph';
import { matchProducts, propagate } from '@logichub-engineering/product-graph';
import { matchKits } from '@logichub-engineering/kit-matching';
import type { PlanTier } from '../schemas/commerce.schema.js';
import type {
  BlockedAction,
  CommerceOffer,
  ConversionJourney,
  KitRecommendation,
  NextStep,
  ProductRecommendation,
} from '../schemas/conversion.schema.js';
import { ACTIVE_PHASE, activePhasePolicy, canSellKits } from '../phase/phase-policy.js';
import { hasEntitlement } from '../plans/tiers.js';

/**
 * Take a configuration from product recommendation through to kit
 * recommendation, in one pass, on the user's own machine.
 *
 * Every stage reads the same graph and calls nothing over a network. The
 * result carries working data and is never transmitted — `redactForWeb` is the
 * only thing that produces something able to leave.
 */
export function buildConversionJourney(
  graph: ProductGraph,
  tier: PlanTier = 'free',
): ConversionJourney {
  const resolved = propagate(graph).graph;

  const productRecommendations: ProductRecommendation[] = matchProducts(resolved).map(match => ({
    templateId: match.templateId,
    templateName: match.templateName,
    verdict: match.verdict,
    score: match.score,
    missingCapabilities: match.missingCapabilities,
  }));

  const kitMatches = matchKits(resolved);
  const kitRecommendations: KitRecommendation[] = kitMatches.map(match => ({
    kitId: match.kitId,
    kitName: match.kitName,
    matchPercentage: match.matchPercentage,
    complete: match.complete,
    // Sourcing and validation come straight from the catalogue. Dropping them
    // here would let a high match percentage read as a purchasable kit.
    sourcingState: worstSourcingState(match.componentManifest.map(r => r.component.sourcing.state)),
    validationStatus: match.validationStatus,
    assemblyDifficulty: match.assemblyDifficulty,
  }));

  const everySourced = kitRecommendations.every(k => k.sourcingState !== 'UNSOURCED');
  const offer = buildOffer(everySourced);

  return {
    sourceGraphId: resolved.id,
    tier,
    productRecommendations,
    kitRecommendations,
    offer,
    nextSteps: buildNextSteps(tier, offer),
    staysInProject: true,
  };
}

function buildOffer(everyComponentSourced: boolean): CommerceOffer {
  const policy = activePhasePolicy();
  const purchasable = canSellKits(ACTIVE_PHASE, everyComponentSourced);

  const blockedActions: BlockedAction[] = [];
  if (!policy.carriesInventory) {
    blockedActions.push({
      action: 'purchase-kit',
      reason: `Phase ${policy.phase} (${policy.name}) holds no stock and sells no kit.`,
    });
  }
  if (!everyComponentSourced) {
    blockedActions.push({
      action: 'quote-price',
      reason: 'No component has a sourced supplier record, so no price exists to quote.',
    });
  }

  return {
    phase: ACTIVE_PHASE,
    phaseName: policy.name,
    purchasable,
    price: purchasable
      ? { state: 'UNAVAILABLE', reason: 'No sourced supplier record backs this kit.' }
      : {
        state: 'UNAVAILABLE',
        reason:
          'Nothing here can be priced: no component carries a sourced supplier record, '
          + 'and this phase holds no stock.',
      },
    availableActions: [
      'export-capsule-locally',
      'view-kit-manifest',
      'open-graph',
      'follow-supplier-links',
    ],
    blockedActions,
    disclosures: [
      'No component in this configuration has been sourced. Part numbers, prices and '
      + 'stock levels are unknown, not zero.',
      'No kit here has been assembled or measured. Match percentage describes capability '
      + 'coverage on paper.',
      'Nothing in this configuration is certified, and no safety or regulatory claim is '
      + 'made about it.',
    ],
  };
}

function buildNextSteps(tier: PlanTier, offer: CommerceOffer): NextStep[] {
  const steps: NextStep[] = [
    {
      id: 'refine-graph',
      label: 'Adjust the configuration',
      local: true,
      available: true,
      reason: 'The graph is on your machine and always editable.',
    },
    {
      id: 'export-capsule',
      label: 'Export a project capsule',
      local: true,
      available: hasEntitlement(tier, 'capsule.export'),
      reason: hasEntitlement(tier, 'capsule.export')
        ? 'Written to your own filesystem; nothing is uploaded.'
        : 'Capsule export is not included in this plan.',
    },
    {
      id: 'generate-operator-app',
      label: 'Generate the operator application',
      local: true,
      available: hasEntitlement(tier, 'app.operator'),
      reason: hasEntitlement(tier, 'app.operator')
        ? 'Generated from the graph on your machine.'
        : 'The operator application is not included in this plan.',
    },
    {
      id: 'order-kit',
      label: 'Order the matching kit',
      local: false,
      available: offer.purchasable,
      reason: offer.purchasable
        ? 'Available to order.'
        : offer.blockedActions.map(b => b.reason).join(' '),
    },
  ];

  return steps;
}

const SOURCING_ORDER = ['UNSOURCED', 'SOURCED', 'VERIFIED'] as const;

/** The weakest state across a manifest; one unsourced part makes the kit unsourced. */
function worstSourcingState(
  states: readonly string[],
): 'UNSOURCED' | 'SOURCED' | 'VERIFIED' {
  let worst = SOURCING_ORDER.length - 1;
  for (const state of states) {
    const index = SOURCING_ORDER.indexOf(state as typeof SOURCING_ORDER[number]);
    if (index >= 0 && index < worst) worst = index;
  }
  return SOURCING_ORDER[worst]!;
}
