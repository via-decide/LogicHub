import type { ProductGraph } from '@logichub-engineering/product-graph';
import { aggregateCapabilities } from '@logichub-engineering/product-graph';
import { hashValue, sha256Hex } from '@logichub-engineering/project-capsule';
import type { ConversionJourney } from '../schemas/conversion.schema.js';
import type {
  ChallengeCard,
  LeakFinding,
  PublicPayload,
  SovereigntyPosture,
} from '../schemas/boundary.schema.js';

/**
 * Domain separation for the two hashes. Without distinct salts, the same graph
 * would produce the same digest for both purposes, and a fingerprint observed
 * in one context would be recognisable in the other.
 */
const FINGERPRINT_SALT = 'logichub.design-fingerprint.v1';
const CHALLENGE_SALT = 'logichub.challenge-signature.v1';

/**
 * Identifies a design to the platform without disclosing it.
 *
 * One-way by construction: the digest is taken over the canonical graph, and
 * SHA-256 is not invertible. It supports exactly one question — "have I seen
 * this design before?" — and answers nothing else.
 */
export function designFingerprint(graph: ProductGraph): string {
  return sha256Hex(`${FINGERPRINT_SALT}:${hashValue(graph)}`);
}

/**
 * Identifies what a design can *do*, rather than how it is built.
 *
 * Taken over the node-type multiset and the aggregated capability keys, so
 * positions, node ids, names and timestamps are excluded. Two people who reach
 * the same capabilities by different routes produce the same signature, which
 * is what makes a challenge solvable rather than a guessing game about ids.
 */
export function challengeSignature(graph: ProductGraph): string {
  const nodeTypes = graph.nodes.map(n => n.type).sort();
  const capabilities = aggregateCapabilities(graph);

  // Capability keys, not values: "has bluetooth" is the shared goal, while the
  // exact estimated range is a property of the specific parts chosen.
  const capabilityKeys = Object.keys(capabilities)
    .filter(key => capabilities[key] !== false)
    .sort();

  return sha256Hex(`${CHALLENGE_SALT}:${hashValue({ nodeTypes, capabilityKeys })}`);
}

/**
 * Project a journey down to what may cross to logichub.app.
 *
 * Built field by field from an allowlist. Nothing is spread or copied
 * wholesale, so a field added to the journey later does not begin crossing the
 * boundary on its own.
 */
export function redactForWeb(journey: ConversionJourney, graph: ProductGraph): PublicPayload {
  const topProduct = journey.productRecommendations[0];
  const topKit = journey.kitRecommendations.find(k => k.complete)
    ?? journey.kitRecommendations[0];

  return {
    designFingerprint: designFingerprint(graph),
    challengeSignature: challengeSignature(graph),
    targetProductTemplateId: topProduct?.templateId ?? null,
    targetProductTemplateName: topProduct?.templateName ?? null,
    verdictLabel: topProduct?.verdict ?? null,
    selectedKitId: topKit?.kitId ?? null,
    selectedKitName: topKit?.kitName ?? null,
    tier: journey.tier,
    purchasable: journey.offer.purchasable,
  };
}

const DIFFICULTY_BY_VERDICT = {
  CAN_MAKE: 'beginner',
  ALMOST_POSSIBLE: 'intermediate',
  NOT_RECOMMENDED: 'advanced',
} as const;

/**
 * Project a payload down to what may be shown to other visitors.
 *
 * The kit is dropped here. It is present in the payload so an order can be
 * placed, but revealing which kit reaches the goal would hand over the answer,
 * and challenge cards are public — there is no login gate behind which to keep
 * them.
 */
export function toChallengeCard(
  payload: PublicPayload,
  origin: ChallengeCard['origin'] = 'shared',
): ChallengeCard {
  const goal = payload.targetProductTemplateName;
  if (goal === null) {
    throw new Error('A challenge needs a goal product; this payload has none.');
  }

  return {
    challengeId: payload.challengeSignature,
    goalProductName: goal,
    difficulty: DIFFICULTY_BY_VERDICT[payload.verdictLabel ?? 'NOT_RECOMMENDED'],
    origin,
    prompt: `Build a configuration that can become a ${goal}.`,
  };
}

/** Keys that only ever appear on working data. */
const FORBIDDEN_KEYS = new Set([
  'nodes',
  'connections',
  'parameters',
  'derivedMetrics',
  'capabilities',
  'requirements',
  'constraints',
  'assignedPins',
  'sourceComponentId',
  'componentManifest',
  'graph',
  'productGraph',
  'measurements',
  'pinMap',
]);

/** Node ids look like `n3_motor_left` or `motion-starter::controller-esp32#0`. */
const NODE_ID_SHAPE = /^(n\d+_[a-z_]+|[a-z-]+::[a-z0-9-]+#\d+)$/;

/**
 * Walk a payload and report anything that looks like working data.
 *
 * This is the enforcement behind the whole architecture. It runs over what is
 * actually about to cross the boundary rather than over the code that built
 * it, so a redactor that grows a leak is caught by its output.
 *
 * An empty result means clean.
 */
export function findLeaks(payload: unknown, path = '$'): LeakFinding[] {
  const findings: LeakFinding[] = [];

  if (payload === null || payload === undefined) return findings;

  if (Array.isArray(payload)) {
    payload.forEach((item, index) => {
      findings.push(...findLeaks(item, `${path}[${index}]`));
    });
    return findings;
  }

  if (typeof payload === 'string') {
    if (NODE_ID_SHAPE.test(payload)) {
      findings.push({
        path,
        kind: 'node-id-shape',
        message: `"${payload}" is shaped like a node id and identifies part of a design.`,
      });
    }
    return findings;
  }

  if (typeof payload !== 'object') return findings;

  for (const key of Object.keys(payload as Record<string, unknown>).sort()) {
    const child = (payload as Record<string, unknown>)[key];
    const childPath = `${path}.${key}`;

    if (FORBIDDEN_KEYS.has(key)) {
      findings.push({
        path: childPath,
        kind: 'forbidden-key',
        message: `"${key}" carries working data and must not cross the boundary.`,
      });
      continue;
    }

    findings.push(...findLeaks(child, childPath));
  }

  return findings.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * Throw if anything is about to cross that should not. Used at the boundary
 * itself, so a leak is a failure rather than a silent disclosure.
 */
export function assertNoLeaks(payload: unknown): void {
  const findings = findLeaks(payload);
  if (findings.length > 0) {
    throw new Error(
      `Payload carries working data and cannot cross the boundary: `
      + findings.map(f => `${f.path} (${f.kind})`).join(', '),
    );
  }
}

/**
 * What the architecture does, stated so every line can be checked against the
 * code above rather than taken on trust.
 *
 * Deliberately absent: any claim about what happens to the user's data
 * elsewhere, any guarantee of immunity from scraping, and any absolute
 * security claim. Those depend on things this repository does not control.
 */
export const SOVEREIGNTY_POSTURE: SovereigntyPosture = {
  crossesToPlatform: [
    'A one-way design fingerprint',
    'A one-way capability signature',
    'The target product template id and name',
    'The verdict word for that product',
    'The selected kit id and name',
    'The plan tier',
    'Whether the offer is purchasable',
  ],
  crossesToOtherVisitors: [
    'The challenge id',
    'The goal product name',
    'A difficulty label',
  ],
  neverCrosses: [
    'The product graph',
    'Node parameters, capabilities, requirements or derived metrics',
    'Pin assignments',
    'Connections between nodes',
    'Component manifests',
    'Project capsules',
    'Measurements and evidence',
  ],
  notes: [
    'Both digests are SHA-256 over canonical input and are not reversible.',
    'The capability signature excludes node ids, positions, names and timestamps, '
    + 'so two designs reaching the same capabilities match without either being disclosed.',
    'Challenge completion is verified locally by recomputing the signature; no design '
    + 'is transmitted in either direction.',
    'The platform cannot show a design it was never sent.',
    'This describes what this software does. It does not describe what happens to '
    + 'files the user shares through other tools.',
  ],
};
