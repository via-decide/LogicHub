import { describe, it, expect } from 'vitest';
import {
  buildChallengeBoard,
  buildReferenceChallenges,
  verifyCompletion,
} from '../src/boundary/challenges.js';
import { challengeSignature, findLeaks, redactForWeb, toChallengeCard } from '../src/boundary/sovereignty.js';
import { buildConversionJourney } from '../src/conversion/journey.js';
import { ChallengeCardSchema } from '../src/schemas/boundary.schema.js';
import { equivalentRoverGraph, monitorGraph, roverGraph } from './helpers.js';

describe('Gate 9 — challenge completion', () => {
  it('accepts an independently built design that reaches the same capabilities', () => {
    // The whole loop: someone shares a code, someone else solves it their own
    // way, and neither design goes anywhere.
    const challengeId = challengeSignature(roverGraph());
    expect(verifyCompletion(challengeId, equivalentRoverGraph())).toBe(true);
  });

  it('rejects a design that reaches somewhere else', () => {
    const challengeId = challengeSignature(roverGraph());
    expect(verifyCompletion(challengeId, monitorGraph())).toBe(false);
  });

  it('accepts the design the challenge came from', () => {
    const graph = roverGraph();
    expect(verifyCompletion(challengeSignature(graph), graph)).toBe(true);
  });

  it('verifies without either design crossing the boundary', () => {
    // Everything verification needs is the shared code plus the candidate,
    // both of which are already on the solver's machine.
    const challengeId = challengeSignature(roverGraph());
    expect(findLeaks({ challengeId })).toEqual([]);
  });
});

describe('Gate 9 — reference challenges', () => {
  const challenges = buildReferenceChallenges();

  it('builds a schema-valid card per reference kit', () => {
    expect(challenges.length).toBeGreaterThan(0);
    for (const card of challenges) {
      expect(ChallengeCardSchema.safeParse(card).success, card.goalProductName).toBe(true);
    }
  });

  it('labels them as reference challenges, not user submissions', () => {
    // There are no users yet, and inventing a community would be fabrication.
    for (const card of challenges) {
      expect(card.origin).toBe('reference');
    }
  });

  it('reveals no kit in any card', () => {
    const text = JSON.stringify(challenges);
    for (const kitId of ['motion-starter', 'environment-starter', 'product-interface']) {
      expect(text).not.toContain(kitId);
    }
  });

  it('lets no working data into any card', () => {
    expect(findLeaks(challenges)).toEqual([]);
  });

  it('is deterministic across runs', () => {
    expect(JSON.stringify(buildReferenceChallenges())).toBe(JSON.stringify(challenges));
  });

  it('is solvable: the kit it came from completes it', () => {
    const journey = buildConversionJourney(roverGraph(), 'creator');
    const card = toChallengeCard(redactForWeb(journey, roverGraph()));
    expect(verifyCompletion(card.challengeId, roverGraph())).toBe(true);
  });
});

describe('Gate 9 — challenge board', () => {
  const challenges = buildReferenceChallenges();

  it('omits a completion count when nothing has been recorded', () => {
    // Not zero, not a placeholder, not a seeded figure — absent.
    const board = buildChallengeBoard(challenges);
    for (const entry of board) {
      expect(entry.completions).toBeUndefined();
      expect(Object.keys(entry)).toEqual(['card']);
    }
  });

  it('shows a count only when it counts real records', () => {
    const records = new Map([[challenges[0].challengeId, 3]]);
    const board = buildChallengeBoard(challenges, records);

    const withCount = board.find(e => e.card.challengeId === challenges[0].challengeId)!;
    expect(withCount.completions).toBe(3);

    const withoutCount = board.find(e => e.card.challengeId !== challenges[0].challengeId)!;
    expect(withoutCount.completions).toBeUndefined();
  });

  it('carries no usernames, leaderboards or social proof', () => {
    const text = JSON.stringify(buildChallengeBoard(challenges));
    for (const term of ['user', 'author', 'leaderboard', 'rank', 'builders', 'solvedBy']) {
      expect(text.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it('orders entries stably', () => {
    const ids = buildChallengeBoard(challenges).map(e => e.card.challengeId);
    expect(ids).toEqual([...ids].sort());
  });
});
