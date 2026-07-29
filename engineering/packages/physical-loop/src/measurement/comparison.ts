import type { LogicNode, ProductGraph } from '@logichub-engineering/product-graph';
import {
  MeasuredQuantitySchema,
  type ComparisonReport,
  type ComparisonState,
  type MeasuredQuantity,
  type Measurement,
  type QuantityComparison,
} from '../schemas/measurement.schema.js';

/** Every quantity the Motion Starter loop asks for, in a stable order. */
export const REQUIRED_QUANTITIES: readonly MeasuredQuantity[] = MeasuredQuantitySchema.options;

export const QUANTITY_UNITS: Record<MeasuredQuantity, string> = {
  'battery.voltage': 'V',
  'idle.current': 'mA',
  'motor.current': 'A',
  'motor.peakCurrent': 'A',
  runtime: 'h',
  'bluetooth.range': 'm',
  'motor.response': 'ms',
  'sensor.detectionRange': 'mm',
};

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Compare what the graph estimated against what was actually measured.
 *
 * Both values are preserved side by side. A measurement never overwrites the
 * estimate it tests — the point of the loop is to see the gap, which is lost
 * the moment one value replaces the other.
 *
 * A quantity with no measurement is NOT_MEASURED. It is never filled with a
 * zero, and never counted as agreeing with its estimate.
 */
export function compareToEstimates(
  graph: ProductGraph,
  measurements: readonly Measurement[],
): ComparisonReport {
  const byQuantity = new Map<MeasuredQuantity, Measurement>();
  // Later readings of the same quantity supersede earlier ones, chosen by
  // timestamp so the result does not depend on array order.
  for (const measurement of [...measurements].sort(compareByRecordedAt)) {
    byQuantity.set(measurement.quantity, measurement);
  }

  const comparisons = REQUIRED_QUANTITIES.map(quantity =>
    compareQuantity(quantity, graph, byQuantity.get(quantity)));

  const unmeasuredQuantities = REQUIRED_QUANTITIES.filter(q => !byQuantity.has(q));
  const complete = unmeasuredQuantities.length === 0;

  return {
    comparisons,
    unmeasuredQuantities: [...unmeasuredQuantities],
    complete,
    summary: complete
      ? `All ${REQUIRED_QUANTITIES.length} required quantities were measured.`
      : `${unmeasuredQuantities.length} of ${REQUIRED_QUANTITIES.length} required quantities `
        + 'have not been measured. This unit is not fully characterised.',
  };
}

function compareQuantity(
  quantity: MeasuredQuantity,
  graph: ProductGraph,
  measurement: Measurement | undefined,
): QuantityComparison {
  const estimated = estimateFor(quantity, graph);
  const measured = measurement?.value;

  let state: ComparisonState;
  if (estimated !== undefined && measured !== undefined) state = 'COMPARED';
  else if (estimated !== undefined) state = 'NOT_MEASURED';
  else if (measured !== undefined) state = 'NO_ESTIMATE';
  else state = 'UNKNOWN';

  const base: QuantityComparison = {
    quantity,
    unit: QUANTITY_UNITS[quantity],
    state,
    ...(estimated === undefined ? {} : { estimated }),
    ...(measured === undefined ? {} : { measured }),
    measurementId: measurement?.id ?? null,
    evidenceRef: measurement?.evidenceRef ?? null,
    note: noteFor(state, quantity),
  };

  if (state !== 'COMPARED' || estimated === undefined || measured === undefined) {
    return base;
  }

  const difference = round(measured - estimated);
  return {
    ...base,
    difference,
    // A percentage against a zero estimate would be meaningless, so it is
    // omitted rather than reported as infinite.
    ...(estimated === 0 ? {} : { percentDifference: round((difference / estimated) * 100, 2) }),
  };
}

function noteFor(state: ComparisonState, quantity: MeasuredQuantity): string {
  switch (state) {
    case 'COMPARED':
      return 'Estimate and measurement are both recorded; neither replaces the other.';
    case 'NOT_MEASURED':
      return `No measurement of ${quantity} has been recorded. The estimate stands untested.`;
    case 'NO_ESTIMATE':
      return `The graph derives no estimate for ${quantity}, so the reading has no baseline.`;
    default:
      return `Neither an estimate nor a measurement exists for ${quantity}.`;
  }
}

/**
 * What the graph predicts for a quantity, where it predicts anything at all.
 *
 * Several quantities in the required set have no counterpart in the model —
 * motor response time and sensor detection range are properties of real parts
 * that nothing here derives. Those return undefined rather than a stand-in.
 */
function estimateFor(quantity: MeasuredQuantity, graph: ProductGraph): number | undefined {
  const nodes = [...graph.nodes].sort((a, b) => (a.id < b.id ? -1 : 1));
  const first = (type: string) => nodes.find(n => n.type === type);

  switch (quantity) {
    case 'battery.voltage':
      return metric(first('battery'), 'nominalVoltageV');

    case 'idle.current': {
      const controller = first('controller');
      return metric(controller, 'idleCurrentMa');
    }

    case 'motor.current':
      return metric(first('motor'), 'typicalCurrentA');

    case 'motor.peakCurrent':
      return metric(first('motor'), 'stallCurrentA');

    case 'runtime':
      return metric(first('battery'), 'estimatedRuntimeH');

    case 'bluetooth.range': {
      const link = nodes.find(
        n => n.type === 'connectivity' && n.derivedMetrics.connectivityType === 'bluetooth',
      );
      return metric(link, 'rangeMEstimate');
    }

    // Response time and detection range are properties of the physical parts
    // that the model does not derive. There is no estimate to offer.
    case 'motor.response':
    case 'sensor.detectionRange':
      return undefined;

    default:
      return undefined;
  }
}

function metric(node: LogicNode | undefined, key: string): number | undefined {
  if (node === undefined) return undefined;
  const raw = node.derivedMetrics[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

function compareByRecordedAt(a: Measurement, b: Measurement): number {
  if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
