export {
  CommercePhaseSchema, type CommercePhase,
  PlanTierSchema, type PlanTier,
  EntitlementSchema, type Entitlement,
  PlanPriceSchema, type PlanPrice,
  PlanSchema, type Plan,
  PriceQuoteSchema, type PriceQuote,
} from './schemas/commerce.schema.js';

export {
  ProductRecommendationSchema, type ProductRecommendation,
  KitRecommendationSchema, type KitRecommendation,
  BlockedActionSchema, type BlockedAction,
  CommerceOfferSchema, type CommerceOffer,
  NextStepSchema, type NextStep,
  ConversionJourneySchema, type ConversionJourney,
} from './schemas/conversion.schema.js';

export {
  PublicPayloadSchema, type PublicPayload,
  ChallengeCardSchema, type ChallengeCard,
  LeakFindingSchema, type LeakFinding,
  SovereigntyPostureSchema, type SovereigntyPosture,
} from './schemas/boundary.schema.js';

export { PLANS, getPlan, hasEntitlement, assertEntitled } from './plans/tiers.js';

export {
  PHASE_POLICIES,
  ACTIVE_PHASE,
  getPhasePolicy,
  activePhasePolicy,
  canSellKits,
  type PhasePolicy,
} from './phase/phase-policy.js';

export { buildConversionJourney } from './conversion/journey.js';

export {
  designFingerprint,
  challengeSignature,
  redactForWeb,
  toChallengeCard,
  findLeaks,
  assertNoLeaks,
  SOVEREIGNTY_POSTURE,
} from './boundary/sovereignty.js';

export {
  verifyCompletion,
  buildReferenceChallenges,
  buildChallengeBoard,
  type ChallengeBoardEntry,
} from './boundary/challenges.js';

export {
  LANDING_CONTENT,
  findUnsupportedClaims,
  allLandingStrings,
  type LandingContent,
  type ClaimFinding,
} from './content/cta.js';
