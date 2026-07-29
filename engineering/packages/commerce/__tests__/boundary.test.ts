import { describe, it, expect } from 'vitest';
import {
  challengeSignature,
  designFingerprint,
  findLeaks,
  assertNoLeaks,
  redactForWeb,
  toChallengeCard,
  SOVEREIGNTY_POSTURE,
} from '../src/boundary/sovereignty.js';
import { buildConversionJourney } from '../src/conversion/journey.js';
import { PublicPayloadSchema, ChallengeCardSchema } from '../src/schemas/boundary.schema.js';
import { equivalentRoverGraph, monitorGraph, roverGraph } from './helpers.js';

function payloadFor(graph = roverGraph()) {
  return redactForWeb(buildConversionJourney(graph, 'creator'), graph);
}

describe('Gate 9 — what crosses to the platform', () => {
  it('produces a schema-valid payload', () => {
    expect(PublicPayloadSchema.safeParse(payloadFor()).success).toBe(true);
  });

  it('carries the selected kit so an order needs no second round trip', () => {
    const payload = payloadFor();
    expect(payload.selectedKitId).toBe('motion-starter');
    expect(payload.selectedKitName).toBe('Motion Starter');
  });

  it('carries the goal product and its verdict word only', () => {
    const payload = payloadFor();
    expect(payload.targetProductTemplateId).toBe('bluetooth-rover');
    expect(payload.verdictLabel).toBe('CAN_MAKE');
    // No score, no capability list, no missing-capability detail.
    expect(Object.keys(payload).sort()).toEqual([
      'challengeSignature', 'designFingerprint', 'purchasable', 'selectedKitId',
      'selectedKitName', 'targetProductTemplateId', 'targetProductTemplateName',
      'tier', 'verdictLabel',
    ]);
  });

  it('lets no working data across', () => {
    expect(findLeaks(payloadFor())).toEqual([]);
  });

  it('drops journey detail rather than passing it through', () => {
    // Redaction is an allowlist, not a filter: the payload is built field by
    // field, so detail the journey holds locally simply has no way across.
    const graph = roverGraph();
    const journey = buildConversionJourney(graph, 'creator');
    const payload = redactForWeb(journey, graph);
    const payloadText = JSON.stringify(payload);

    expect(payloadText).not.toContain(journey.sourceGraphId);
    expect(payloadText).not.toContain('missingCapabilities');
    expect(payloadText).not.toContain('nextSteps');
    expect(payloadText).not.toContain('disclosures');

    // Every kit the matcher considered stays local; only the selected one crosses.
    expect(journey.kitRecommendations.length).toBeGreaterThan(1);
    for (const kit of journey.kitRecommendations.filter(k => k.kitId !== payload.selectedKitId)) {
      expect(payloadText).not.toContain(kit.kitId);
    }
  });

  it('would catch a graph stuffed into the payload by mistake', () => {
    // The guard is what makes the allowlist trustworthy, so it must fire on
    // the thing it exists to stop.
    expect(findLeaks({ ...payloadFor(), graph: roverGraph() }).length).toBeGreaterThan(0);
  });
});

describe('Gate 9 — what other visitors see', () => {
  it('produces a schema-valid challenge card', () => {
    expect(ChallengeCardSchema.safeParse(toChallengeCard(payloadFor())).success).toBe(true);
  });

  it('never reveals the kit that solves it', () => {
    // Working out which configuration reaches the goal is the game. Challenge
    // cards are public, so the answer cannot ride along with the question.
    const card = toChallengeCard(payloadFor());
    expect(JSON.stringify(card)).not.toContain('motion-starter');
    expect(JSON.stringify(card)).not.toContain('Motion Starter');
    expect(Object.keys(card)).not.toContain('selectedKitId');
  });

  it('shows the goal, which is what makes it solvable', () => {
    const card = toChallengeCard(payloadFor());
    expect(card.goalProductName).toBe('Bluetooth Rover');
    expect(card.prompt).toMatch(/Build a configuration that can become a Bluetooth Rover/);
  });

  it('lets no working data across', () => {
    expect(findLeaks(toChallengeCard(payloadFor()))).toEqual([]);
  });

  it('refuses to make a challenge with no goal', () => {
    const payload = { ...payloadFor(), targetProductTemplateName: null };
    expect(() => toChallengeCard(payload)).toThrow(/needs a goal product/);
  });
});

describe('Gate 9 — the two one-way digests', () => {
  it('produces stable digests for the same design', () => {
    const graph = roverGraph();
    expect(designFingerprint(graph)).toBe(designFingerprint(graph));
    expect(challengeSignature(graph)).toBe(challengeSignature(graph));
  });

  it('keeps the two digests distinct for the same design', () => {
    // Separate salts, so a fingerprint seen in one context is not recognisable
    // in the other.
    const graph = roverGraph();
    expect(designFingerprint(graph)).not.toBe(challengeSignature(graph));
  });

  it('reveals nothing about the design it came from', () => {
    const graph = roverGraph();
    const fingerprint = designFingerprint(graph);

    // A fixed-width digest carries no structure to read: it is the same 64
    // hex characters whatever the design's size or contents.
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    for (const node of graph.nodes) {
      expect(fingerprint).not.toContain(node.id);
      expect(fingerprint).not.toContain(node.type);
    }
    expect(findLeaks({ fingerprint })).toEqual([]);
  });

  it('is the same length whatever the size of the design', () => {
    // Length would otherwise leak how large a design is.
    expect(designFingerprint(roverGraph())).toHaveLength(64);
    expect(designFingerprint(monitorGraph())).toHaveLength(64);
    expect(challengeSignature(roverGraph())).toHaveLength(64);
  });

  it('gives the same challenge signature to the same capabilities reached differently', () => {
    // Different node ids, different order, larger pack, different pin names.
    expect(challengeSignature(equivalentRoverGraph())).toBe(challengeSignature(roverGraph()));
  });

  it('gives a different challenge signature to a different product', () => {
    expect(challengeSignature(monitorGraph())).not.toBe(challengeSignature(roverGraph()));
  });

  it('gives those two designs different fingerprints even though they solve alike', () => {
    // They are the same solution but not the same design, and the fingerprint
    // tracks identity rather than capability.
    expect(designFingerprint(equivalentRoverGraph()))
      .not.toBe(designFingerprint(roverGraph()));
  });
});

describe('Gate 9 — leak detection', () => {
  it('catches a payload carrying node parameters', () => {
    const leaky = { ...payloadFor(), parameters: { cellCount: 4 } };
    const findings = findLeaks(leaky);

    expect(findings.map(f => f.kind)).toContain('forbidden-key');
    expect(findings[0].path).toBe('$.parameters');
  });

  it('catches a payload carrying the graph itself', () => {
    expect(findLeaks({ graph: roverGraph() }).length).toBeGreaterThan(0);
  });

  it('catches a bare node id smuggled into a string field', () => {
    const findings = findLeaks({ note: 'n3_motor_left' });
    expect(findings.map(f => f.kind)).toContain('node-id-shape');
  });

  it('catches a kit-loaded node id shape too', () => {
    const findings = findLeaks({ ref: 'motion-starter::controller-esp32#0' });
    expect(findings.map(f => f.kind)).toContain('node-id-shape');
  });

  it('looks inside nested structures and arrays', () => {
    const findings = findLeaks({ outer: [{ inner: { derivedMetrics: {} } }] });
    expect(findings[0].path).toBe('$.outer[0].inner.derivedMetrics');
  });

  it('does not flag ordinary content', () => {
    expect(findLeaks({ title: 'Bluetooth Rover', count: 3, ok: true })).toEqual([]);
  });

  it('throws at the boundary rather than disclosing quietly', () => {
    expect(() => assertNoLeaks({ nodes: [] })).toThrow(/cannot cross the boundary/);
    expect(() => assertNoLeaks(payloadFor())).not.toThrow();
  });

  it('reports findings in a stable order', () => {
    const findings = findLeaks({ parameters: {}, connections: [], capabilities: {} });
    expect(findings.map(f => f.path)).toEqual([...findings.map(f => f.path)].sort());
  });
});

describe('Gate 9 — sovereignty posture', () => {
  it('enumerates what crosses in each direction', () => {
    expect(SOVEREIGNTY_POSTURE.crossesToPlatform.length).toBeGreaterThan(0);
    expect(SOVEREIGNTY_POSTURE.crossesToOtherVisitors.length).toBeGreaterThan(0);
    expect(SOVEREIGNTY_POSTURE.neverCrosses).toContain('The product graph');
  });

  it('claims less of the visitor projection than of the platform one', () => {
    expect(SOVEREIGNTY_POSTURE.crossesToOtherVisitors.length)
      .toBeLessThan(SOVEREIGNTY_POSTURE.crossesToPlatform.length);
  });

  it('makes no claim about what happens outside this software', () => {
    const text = JSON.stringify(SOVEREIGNTY_POSTURE);
    expect(text).not.toMatch(/immune/i);
    expect(text).not.toMatch(/absolute/i);
    expect(text).not.toMatch(/guarantee/i);
    // It says what it does control, and marks the limit.
    expect(SOVEREIGNTY_POSTURE.notes.join(' '))
      .toMatch(/does not describe what happens to files the user shares through other tools/);
  });
});
