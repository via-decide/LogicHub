import { z } from 'zod';
import { PlanTierSchema } from './commerce.schema.js';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);

/**
 * What may cross from the user's machine to logichub.app.
 *
 * This is an allowlist, not a filter: the redactor constructs it field by
 * field from the journey. Nothing is copied across wholesale, so a new field
 * added to the journey does not silently start crossing the boundary.
 */
export const PublicPayloadSchema = z.object({
  /** Opaque, one-way. Lets the site recognise a returning design, nothing more. */
  designFingerprint: HashSchema,
  /** Opaque, one-way. Matches designs by what they can do, not how they do it. */
  challengeSignature: HashSchema,
  targetProductTemplateId: z.string().min(1).nullable(),
  targetProductTemplateName: z.string().min(1).nullable(),
  /** The verdict word only — no score, no capability list. */
  verdictLabel: z.enum(['CAN_MAKE', 'ALMOST_POSSIBLE', 'NOT_RECOMMENDED']).nullable(),
  /** Present so an order can be placed without a second round trip. */
  selectedKitId: z.string().min(1).nullable(),
  selectedKitName: z.string().min(1).nullable(),
  tier: PlanTierSchema,
  purchasable: z.boolean(),
});
export type PublicPayload = z.infer<typeof PublicPayloadSchema>;

/**
 * What may be shown to other visitors.
 *
 * There is no login gate, so a challenge card is effectively public and gets a
 * stricter allowlist than the payload it comes from. The kit is deliberately
 * absent: working out which configuration reaches the goal is the game.
 */
export const ChallengeCardSchema = z.object({
  challengeId: HashSchema,
  /** The goal, which is what makes the challenge solvable. */
  goalProductName: z.string().min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  /** Where this challenge came from. Reference challenges are not user submissions. */
  origin: z.enum(['reference', 'shared']),
  prompt: z.string().min(1),
});
export type ChallengeCard = z.infer<typeof ChallengeCardSchema>;

export const LeakFindingSchema = z.object({
  path: z.string().min(1),
  kind: z.enum(['forbidden-key', 'node-id-shape', 'graph-structure']),
  message: z.string().min(1),
});
export type LeakFinding = z.infer<typeof LeakFindingSchema>;

/**
 * What the architecture does and does not do, stated so each line is checkable
 * against the code rather than against a promise.
 */
export const SovereigntyPostureSchema = z.object({
  crossesToPlatform: z.array(z.string().min(1)),
  crossesToOtherVisitors: z.array(z.string().min(1)),
  neverCrosses: z.array(z.string().min(1)),
  notes: z.array(z.string().min(1)),
});
export type SovereigntyPosture = z.infer<typeof SovereigntyPostureSchema>;
