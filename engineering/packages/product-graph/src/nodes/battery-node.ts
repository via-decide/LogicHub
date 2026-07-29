import {
  BatteryParamsSchema,
  type BatteryChemistry,
  type BatteryParams,
} from '../schemas/node-params.schema.js';
import {
  round,
  readNumber,
  type ConnectionSpec,
  type ConstraintResult,
  type MetricValue,
  type NodeContext,
  type NodePlugin,
  type ParameterBound,
} from './node-plugin.js';

/**
 * Nominal cell voltages. These are the standard nominal figures for each
 * chemistry, not measured values for any specific cell — a real pack must be
 * measured before any physical claim is made about it.
 */
const CELL_VOLTAGE: Record<BatteryChemistry, number> = {
  lipo: 3.7,
  liion: 3.6,
  nimh: 1.2,
  alkaline: 1.5,
};

/**
 * First release does not enable high-current battery configurations. Packs
 * that can deliver more than this are rejected outright, in every user mode.
 */
export const MAX_RELEASE_PEAK_CURRENT_A = 60;

/** Explore mode keeps beginners well inside a low-energy envelope. */
const EXPLORE_MAX_CELLS = 4;
const EXPLORE_MAX_PEAK_CURRENT_A = 20;
const EXPLORE_CHEMISTRIES: readonly BatteryChemistry[] = ['lipo', 'nimh', 'alkaline'];

const CONNECTIONS: readonly ConnectionSpec[] = [
  { type: 'power', direction: 'out', label: 'Power out' },
];

const BOUNDS: readonly ParameterBound[] = [
  { parameter: 'cellCount', min: 1, max: EXPLORE_MAX_CELLS },
  { parameter: 'capacityMah', min: 500, max: 5000 },
  { parameter: 'dischargeRating', min: 1, max: 25 },
  { parameter: 'chemistry', allowedValues: EXPLORE_CHEMISTRIES },
];

export const BatteryNode: NodePlugin<BatteryParams> = {
  nodeType: 'battery',
  category: 'hardware',
  defaultParameters: BatteryParamsSchema.parse({}),

  parseParameters(raw) {
    return BatteryParamsSchema.parse(raw);
  },

  deriveMetrics(params, ctx) {
    const cellVoltage = CELL_VOLTAGE[params.chemistry];
    const nominalVoltageV = round(params.cellCount * cellVoltage);
    const storedEnergyWh = round((nominalVoltageV * params.capacityMah) / 1000);
    const peakCurrentA = round((params.capacityMah * params.dischargeRating) / 1000);

    const metrics: Record<string, MetricValue> = {
      cellVoltageV: cellVoltage,
      nominalVoltageV,
      storedEnergyWh,
      peakCurrentA,
      epistemicState: 'CALCULATED',
    };

    // Runtime depends on what the rest of the graph actually draws. If no
    // downstream node has published a load, runtime stays unknown — it must
    // never silently become zero or infinity.
    const downstreamLoadW = sumDownstreamLoadW(ctx);
    if (downstreamLoadW === undefined) {
      metrics.runtimeKnown = false;
    } else if (downstreamLoadW > 0) {
      metrics.runtimeKnown = true;
      metrics.totalLoadW = round(downstreamLoadW);
      metrics.estimatedRuntimeH = round(storedEnergyWh / downstreamLoadW);
      metrics.estimatedRuntimeMin = round((storedEnergyWh / downstreamLoadW) * 60, 1);
      // Runtime inherits the weakest input: downstream draw is an estimate.
      metrics.runtimeEpistemicState = 'ESTIMATED';
    } else {
      metrics.runtimeKnown = false;
    }

    return metrics;
  },

  exposeCapabilities(_params, metrics) {
    const capabilities: Record<string, unknown> = {
      'battery.present': true,
      'power.available': true,
      'power.voltageV': metrics.nominalVoltageV,
      'power.maxCurrentA': metrics.peakCurrentA,
      'power.energyWh': metrics.storedEnergyWh,
    };
    if (metrics.runtimeKnown === true) {
      capabilities['battery.runtimeH'] = metrics.estimatedRuntimeH;
    }
    return capabilities;
  },

  exposeRequirements() {
    return {};
  },

  validate(params, ctx) {
    const results: ConstraintResult[] = [];
    const peakCurrentA = (params.capacityMah * params.dischargeRating) / 1000;

    if (peakCurrentA > MAX_RELEASE_PEAK_CURRENT_A) {
      results.push({
        code: 'battery.high-current-not-enabled',
        severity: 'error',
        message:
          `Pack can deliver ${round(peakCurrentA, 1)} A peak, above the ` +
          `${MAX_RELEASE_PEAK_CURRENT_A} A ceiling. High-current battery ` +
          'configurations are not enabled in this release.',
      });
    }

    if (ctx.userMode === 'explore') {
      if (params.cellCount > EXPLORE_MAX_CELLS) {
        results.push({
          code: 'battery.explore-cell-count',
          severity: 'error',
          message: `Beginner mode allows at most ${EXPLORE_MAX_CELLS} cells; ${params.cellCount} requested.`,
        });
      }
      if (!EXPLORE_CHEMISTRIES.includes(params.chemistry)) {
        results.push({
          code: 'battery.explore-chemistry',
          severity: 'error',
          message: `Beginner mode does not enable ${params.chemistry} packs.`,
        });
      }
      if (peakCurrentA > EXPLORE_MAX_PEAK_CURRENT_A) {
        results.push({
          code: 'battery.explore-peak-current',
          severity: 'error',
          message:
            `Beginner mode limits peak current to ${EXPLORE_MAX_PEAK_CURRENT_A} A; ` +
            `this pack reaches ${round(peakCurrentA, 1)} A.`,
        });
      }
      if (params.capacityMah < 500 || params.capacityMah > 5000) {
        results.push({
          code: 'battery.explore-capacity',
          severity: 'error',
          message: 'Beginner mode allows 500-5000 mAh packs.',
        });
      }
    }

    return results;
  },

  acceptConnections() {
    return CONNECTIONS;
  },

  getSafeParameterBounds() {
    return BOUNDS;
  },
};

/**
 * Total downstream power draw, or undefined when nothing downstream has
 * published a load. Unknown stays unknown.
 */
function sumDownstreamLoadW(ctx: NodeContext): number | undefined {
  let total: number | undefined;
  for (const node of ctx.transitiveDownstreamNodes) {
    const load = readNumber(node.requirements as Record<string, unknown>, 'power.loadW');
    if (load !== undefined) {
      total = (total ?? 0) + load;
    }
  }
  return total;
}
