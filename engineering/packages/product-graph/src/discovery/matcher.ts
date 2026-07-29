import type { ProductGraph } from '../schemas/product-graph.schema.js';
import type {
  CapabilityRequirement,
  MatchResult,
  MatchVerdict,
  ProductTemplate,
} from '../schemas/discovery.schema.js';
import { PRODUCT_TEMPLATES } from './templates.js';
import { round } from '../nodes/node-plugin.js';

/**
 * Required capabilities carry almost all of the score, so a configuration that
 * satisfies every hard requirement always lands at or above the CAN_MAKE
 * threshold, and one that misses even a single hard requirement never can.
 */
const REQUIRED_WEIGHT_SHARE = 0.9;
const OPTIONAL_WEIGHT_SHARE = 0.1;

export const CAN_MAKE_THRESHOLD = 0.9;
export const ALMOST_POSSIBLE_THRESHOLD = 0.6;

const VERDICT_RANK: Record<MatchVerdict, number> = {
  CAN_MAKE: 0,
  ALMOST_POSSIBLE: 1,
  NOT_RECOMMENDED: 2,
};

/**
 * Collapse every node's capabilities into one bag.
 *
 * Counts add up, booleans OR together, and other numbers take the maximum
 * available. Nodes are visited in stable id order, so the same graph always
 * produces the same bag.
 */
export function aggregateCapabilities(graph: ProductGraph): Record<string, unknown> {
  const bag: Record<string, unknown> = {};
  const nodes = [...graph.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const node of nodes) {
    for (const key of Object.keys(node.capabilities).sort()) {
      const incoming = node.capabilities[key];
      const existing = bag[key];

      if (existing === undefined) {
        bag[key] = incoming;
        continue;
      }

      if (typeof incoming === 'boolean' && typeof existing === 'boolean') {
        bag[key] = existing || incoming;
      } else if (typeof incoming === 'number' && typeof existing === 'number') {
        bag[key] = key.endsWith('.count')
          ? round(existing + incoming)
          : Math.max(existing, incoming);
      } else {
        bag[key] = incoming;
      }
    }
  }

  return bag;
}

/**
 * Rank every template against the graph.
 *
 * A verdict describes capability arithmetic only. CAN_MAKE means the numbers
 * work out on paper — it is not a statement that the product has been built,
 * measured, certified, or found safe for any audience.
 */
export function matchProducts(
  graph: ProductGraph,
  templates: readonly ProductTemplate[] = PRODUCT_TEMPLATES,
): MatchResult[] {
  const capabilities = aggregateCapabilities(graph);

  const results = templates.map(template => evaluateTemplate(template, capabilities));

  results.sort((a, b) => {
    const rank = VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict];
    if (rank !== 0) return rank;
    if (a.score !== b.score) return b.score - a.score;
    return a.templateId < b.templateId ? -1 : a.templateId > b.templateId ? 1 : 0;
  });

  return results;
}

function evaluateTemplate(
  template: ProductTemplate,
  capabilities: Record<string, unknown>,
): MatchResult {
  const matchedCapabilities: string[] = [];
  const missingCapabilities: string[] = [];
  const suggestedChanges: string[] = [];

  let requiredWeight = 0;
  let requiredMet = 0;
  for (const requirement of template.requiredCapabilities) {
    requiredWeight += requirement.weight;
    if (satisfies(requirement, capabilities)) {
      requiredMet += requirement.weight;
      matchedCapabilities.push(requirement.capability);
    } else {
      missingCapabilities.push(requirement.capability);
      suggestedChanges.push(describeGap(requirement, capabilities));
    }
  }

  let optionalWeight = 0;
  let optionalMet = 0;
  for (const requirement of template.optionalCapabilities) {
    optionalWeight += requirement.weight;
    if (satisfies(requirement, capabilities)) {
      optionalMet += requirement.weight;
      matchedCapabilities.push(requirement.capability);
    }
  }

  const requiredFraction = requiredWeight === 0 ? 1 : requiredMet / requiredWeight;
  const optionalFraction = optionalWeight === 0 ? 1 : optionalMet / optionalWeight;

  const score = round(
    REQUIRED_WEIGHT_SHARE * requiredFraction + OPTIONAL_WEIGHT_SHARE * optionalFraction,
  );

  const allRequiredMet = missingCapabilities.length === 0;
  let verdict: MatchVerdict;
  if (allRequiredMet && score >= CAN_MAKE_THRESHOLD) {
    verdict = 'CAN_MAKE';
  } else if (score >= ALMOST_POSSIBLE_THRESHOLD) {
    verdict = 'ALMOST_POSSIBLE';
  } else {
    verdict = 'NOT_RECOMMENDED';
  }

  return {
    templateId: template.id,
    templateName: template.name,
    verdict,
    score,
    matchedCapabilities: matchedCapabilities.sort(),
    missingCapabilities: missingCapabilities.sort(),
    suggestedChanges,
  };
}

/**
 * A capability the graph does not publish is unknown, and unknown never
 * counts as satisfied.
 */
function satisfies(
  requirement: CapabilityRequirement,
  capabilities: Record<string, unknown>,
): boolean {
  const actual = capabilities[requirement.capability];
  if (actual === undefined || actual === null) return false;

  switch (requirement.operator) {
    case 'exists':
      return actual !== false;
    case 'eq':
      return actual === requirement.value;
    case 'gte':
      return typeof actual === 'number'
        && typeof requirement.value === 'number'
        && actual >= requirement.value;
    case 'lte':
      return typeof actual === 'number'
        && typeof requirement.value === 'number'
        && actual <= requirement.value;
    default:
      return false;
  }
}

function describeGap(
  requirement: CapabilityRequirement,
  capabilities: Record<string, unknown>,
): string {
  const actual = capabilities[requirement.capability];
  const name = requirement.capability;

  if (actual === undefined || actual === null) {
    return `Add ${name}: nothing in this configuration provides it.`;
  }

  switch (requirement.operator) {
    case 'gte':
      return `Increase ${name} to at least ${requirement.value} (currently ${String(actual)}).`;
    case 'lte':
      return `Reduce ${name} to at most ${requirement.value} (currently ${String(actual)}).`;
    case 'eq':
      return `Set ${name} to ${String(requirement.value)} (currently ${String(actual)}).`;
    default:
      return `Provide ${name}.`;
  }
}
