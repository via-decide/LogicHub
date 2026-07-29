import type { PhysicalComponent, AvailabilityState } from '../schemas/component.schema.js';
import type { CostEstimate } from '../schemas/component.schema.js';

/** Deterministic rounding, matching the convention used across the platform. */
function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface VoltageVerdict {
  compatible: boolean;
  /** Set when the check could not be made rather than when it failed. */
  unknown: boolean;
  message: string;
}

/**
 * Check a supply against a component's electrical envelope.
 *
 * A component with no envelope, or a supply that is not known, yields an
 * `unknown` verdict. Unknown is never reported as compatible.
 */
export function checkSupplyVoltage(
  component: PhysicalComponent,
  supplyV: number | undefined,
): VoltageVerdict {
  if (component.electrical === null) {
    return {
      compatible: false,
      unknown: true,
      message: `${component.name} publishes no electrical envelope; compatibility is unevaluated.`,
    };
  }
  if (supplyV === undefined) {
    return {
      compatible: false,
      unknown: true,
      message: `Supply voltage is unknown, so ${component.name} cannot be checked against it.`,
    };
  }

  const { supplyVoltageMinV: min, supplyVoltageMaxV: max } = component.electrical;
  if (round(supplyV) > round(max)) {
    return {
      compatible: false,
      unknown: false,
      message:
        `${component.name} accepts at most ${max} V but the configuration supplies `
        + `${round(supplyV, 2)} V.`,
    };
  }
  if (round(supplyV) < round(min)) {
    return {
      compatible: false,
      unknown: false,
      message:
        `${component.name} needs at least ${min} V but the configuration supplies `
        + `${round(supplyV, 2)} V.`,
    };
  }
  return { compatible: true, unknown: false, message: '' };
}

/**
 * Total the cost of a component list.
 *
 * If any single part is unpriced the total is UNKNOWN. A partial sum would
 * read as a real price while quietly treating unpriced parts as free.
 */
export function totalCost(components: readonly { component: PhysicalComponent; quantity: number }[]): CostEstimate {
  const unpriced = components.filter(c => c.component.sourcing.cost.state === 'UNKNOWN');

  if (unpriced.length > 0) {
    return {
      state: 'UNKNOWN',
      reason:
        `${unpriced.length} of ${components.length} components have no sourced price. `
        + 'A total is not reported until every part is priced.',
    };
  }

  let amount = 0;
  let currency: string | undefined;
  for (const { component, quantity } of components) {
    const cost = component.sourcing.cost;
    if (cost.state !== 'KNOWN') continue;
    if (currency === undefined) currency = cost.currency;
    if (currency !== cost.currency) {
      return {
        state: 'UNKNOWN',
        reason: 'Component prices are recorded in more than one currency; no total is reported.',
      };
    }
    amount += cost.amount * quantity;
  }

  if (currency === undefined) {
    return { state: 'UNKNOWN', reason: 'No component carries a sourced price.' };
  }

  return {
    state: 'KNOWN',
    currency,
    amount: round(amount, 2),
    sourcedAt: new Date(0).toISOString(),
    sourceRef: 'aggregate-of-component-sourcing-records',
  };
}

/** Precedence used when collapsing many availability states into one. */
const AVAILABILITY_PRECEDENCE: readonly AvailabilityState[] = [
  'UNKNOWN',
  'DISCONTINUED',
  'OUT_OF_STOCK',
  'LOW_STOCK',
  'IN_STOCK',
];

/**
 * Collapse per-component availability into a single state. Unknown wins over
 * everything: one unknown part means the kit's availability is not known.
 */
export function aggregateAvailability(
  components: readonly { component: PhysicalComponent }[],
): AvailabilityState {
  if (components.length === 0) return 'UNKNOWN';

  let worstIndex = AVAILABILITY_PRECEDENCE.length - 1;
  for (const { component } of components) {
    const index = AVAILABILITY_PRECEDENCE.indexOf(component.sourcing.availability);
    if (index < worstIndex) worstIndex = index;
  }
  return AVAILABILITY_PRECEDENCE[worstIndex]!;
}
