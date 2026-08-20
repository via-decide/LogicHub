import type { ProductGraph } from '@logichub-engineering/product-graph';
import { matchProducts } from '@logichub-engineering/product-graph';
import { REFERENCE_KITS } from '@logichub-engineering/kit-matching';
import type { ChallengeCard } from '../schemas/boundary.schema.js';

/**
 * Verify that a candidate design solves a challenge.
 *
 * The public goal is evaluated against the candidate on the user's own machine.
 * Neither the challenge author's design nor the solver's design is transmitted.
 * The opaque id is only the challenge's identity and contains no solving data.
 */
export function verifyCompletion(challenge: ChallengeCard, candidate: ProductGraph): boolean {
  const match = matchProducts(candidate)
    .find(result => result.templateName === challenge.goalProductName);
  return match?.verdict === 'CAN_MAKE';
}

/**
 * Challenges derived from the four reference kits.
 *
 * These are labelled `reference` because that is what they are. They are not
 * user submissions, and presenting them as such would be inventing a community
 * that does not exist yet.
 */
export function buildReferenceChallenges(): ChallengeCard[] {
  return REFERENCE_KITS
    .filter(kit => kit.supportedProductTemplateIds.length > 0)
    .map(kit => {
      const goal = goalNameFor(kit.supportedProductTemplateIds[0]!);

      return {
        challengeId: createOpaqueChallengeId(),
        goalProductName: goal,
        difficulty: kit.assemblyDifficulty,
        origin: 'reference' as const,
        prompt: `Build a configuration that can become a ${goal}.`,
      };
    })
    .sort((a, b) => (a.challengeId < b.challengeId ? -1 : 1));
}

/** A random public identity that cannot be enumerated from the kit catalogue. */
function createOpaqueChallengeId(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * A challenge board.
 *
 * `completions` is present only when it is a count of records actually held.
 * There is no seeded figure and no placeholder: with nothing recorded, the
 * field is absent rather than zero-dressed-as-popular or invented.
 */
export interface ChallengeBoardEntry {
  card: ChallengeCard;
  completions?: number;
}

export function buildChallengeBoard(
  cards: readonly ChallengeCard[],
  completionRecords: ReadonlyMap<string, number> = new Map(),
): ChallengeBoardEntry[] {
  return cards
    .map(card => {
      const recorded = completionRecords.get(card.challengeId);
      return recorded === undefined ? { card } : { card, completions: recorded };
    })
    .sort((a, b) => (a.card.challengeId < b.card.challengeId ? -1 : 1));
}

const GOAL_NAMES: Record<string, string> = {
  'bluetooth-rover': 'Bluetooth Rover',
  'line-follower': 'Line Follower',
  'obstacle-avoider': 'Obstacle Avoider',
  'educational-robot': 'Educational Robot',
  'camera-slider': 'Camera Slider',
  'conveyor-controller': 'Conveyor Controller',
  'greenhouse-monitor': 'Greenhouse Monitor',
  'irrigation-controller': 'Irrigation Controller',
  'room-monitor': 'Room Monitor',
  'portable-diagnostic': 'Portable Diagnostic',
};

function goalNameFor(templateId: string): string {
  return GOAL_NAMES[templateId] ?? templateId;
}
