import { z } from 'zod';
import { CommercePhaseSchema, PlanTierSchema, PriceQuoteSchema } from './commerce.schema.js';

export const ProductRecommendationSchema = z.object({
  templateId: z.string().min(1),
  templateName: z.string().min(1),
  verdict: z.enum(['CAN_MAKE', 'ALMOST_POSSIBLE', 'NOT_RECOMMENDED']),
  score: z.number().min(0).max(1),
  missingCapabilities: z.array(z.string()),
});
export type ProductRecommendation = z.infer<typeof ProductRecommendationSchema>;

export const KitRecommendationSchema = z.object({
  kitId: z.string().min(1),
  kitName: z.string().min(1),
  matchPercentage: z.number().int().min(0).max(100),
  complete: z.boolean(),
  /** Carried through from the catalogue, never flattened away at this boundary. */
  sourcingState: z.enum(['UNSOURCED', 'SOURCED', 'VERIFIED']),
  validationStatus: z.enum(['UNVALIDATED', 'SIMULATED', 'BENCH_TESTED', 'FIELD_VALIDATED']),
  assemblyDifficulty: z.enum(['beginner', 'intermediate', 'advanced']),
});
export type KitRecommendation = z.infer<typeof KitRecommendationSchema>;

export const BlockedActionSchema = z.object({
  action: z.string().min(1),
  reason: z.string().min(1),
});
export type BlockedAction = z.infer<typeof BlockedActionSchema>;

export const CommerceOfferSchema = z.object({
  phase: CommercePhaseSchema,
  phaseName: z.string().min(1),
  purchasable: z.boolean(),
  price: PriceQuoteSchema,
  availableActions: z.array(z.string().min(1)),
  blockedActions: z.array(BlockedActionSchema),
  /** Statements of what has and has not been established about this offer. */
  disclosures: z.array(z.string().min(1)),
});
export type CommerceOffer = z.infer<typeof CommerceOfferSchema>;

export const NextStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** True when the step runs entirely on the user's own machine. */
  local: z.boolean(),
  available: z.boolean(),
  reason: z.string().min(1),
});
export type NextStep = z.infer<typeof NextStepSchema>;

/**
 * The whole path from configuration to kit, in one object.
 *
 * This is the local-side artefact. It carries the user's working data and is
 * never transmitted; `redactForWeb` produces the only thing that may leave.
 */
export const ConversionJourneySchema = z.object({
  sourceGraphId: z.string().min(1),
  tier: PlanTierSchema,
  productRecommendations: z.array(ProductRecommendationSchema),
  kitRecommendations: z.array(KitRecommendationSchema),
  offer: CommerceOfferSchema,
  nextSteps: z.array(NextStepSchema),
  /**
   * Every step of this journey resolved locally. No stage of the path from
   * product recommendation to kit recommendation required a network call.
   */
  staysInProject: z.literal(true),
});
export type ConversionJourney = z.infer<typeof ConversionJourneySchema>;
