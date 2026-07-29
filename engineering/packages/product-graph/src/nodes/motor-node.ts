import {
  MotorParamsSchema,
  type MotorType,
  type MotorParams,
} from '../schemas/node-params.schema.js';
import {
  round,
  readNumber,
  type ConnectionSpec,
  type ConstraintResult,
  type MetricValue,
  type NodePlugin,
  type ParameterBound,
} from './node-plugin.js';

/**
 * Gearbox transmission efficiency. A single-stage direct drive loses nothing
 * worth modelling; any reduction stage is approximated at 85%. This is an
 * ESTIMATE for feasibility arithmetic, not a measured gearbox figure.
 */
const GEARBOX_EFFICIENCY = 0.85;

/**
 * Typical running current as a fraction of stall current. Real draw depends on
 * load, surface, and duty cycle; this is only used to size supplies.
 */
const TYPICAL_LOAD_FRACTION = 0.4;

/**
 * Supply tolerance around the nameplate rating. Both sides of the comparison
 * are rounded before being compared: `3 * 1.2` is not exactly 3.6 in binary
 * floating point, and a supply sitting precisely on the limit must land the
 * same way on every machine and every run.
 */
const OVERVOLTAGE_MARGIN = 1.2;
const UNDERVOLTAGE_MARGIN = 0.8;

const DRIVER_REQUIREMENT: Record<MotorType, string> = {
  'dc-brushed': 'h-bridge',
  servo: 'direct',
  stepper: 'stepper-driver',
};

const CONNECTIONS: readonly ConnectionSpec[] = [
  { type: 'power', direction: 'in', label: 'Power in' },
  { type: 'control', direction: 'in', label: 'Control in' },
  { type: 'mechanical', direction: 'out', label: 'Shaft out' },
];

const BOUNDS: readonly ParameterBound[] = [
  { parameter: 'ratedVoltageV', min: 3, max: 12 },
  { parameter: 'noLoadRpm', min: 10, max: 1000 },
  { parameter: 'stallCurrentA', min: 0.05, max: 3 },
  { parameter: 'gearRatio', min: 1, max: 300 },
  { parameter: 'wheelDiameterMm', min: 20, max: 150 },
];

export const MotorNode: NodePlugin<MotorParams> = {
  nodeType: 'motor',
  category: 'hardware',
  defaultParameters: MotorParamsSchema.parse({}),

  parseParameters(raw) {
    return MotorParamsSchema.parse(raw);
  },

  deriveMetrics(params) {
    const efficiency = params.gearRatio === 1 ? 1 : GEARBOX_EFFICIENCY;
    const effectiveRpm = round(params.noLoadRpm / params.gearRatio);
    const effectiveTorqueNcm = round(params.stallTorqueNcm * params.gearRatio * efficiency);
    const speedMps = round((Math.PI * params.wheelDiameterMm * effectiveRpm) / 60000);
    const typicalCurrentA = round(params.stallCurrentA * TYPICAL_LOAD_FRACTION);
    const powerConsumptionW = round(params.ratedVoltageV * typicalCurrentA);

    return {
      motorType: params.motorType,
      gearboxEfficiency: efficiency,
      effectiveRpm,
      effectiveTorqueNcm,
      speedMps,
      typicalCurrentA,
      stallCurrentA: params.stallCurrentA,
      powerConsumptionW,
      stallPowerW: round(params.ratedVoltageV * params.stallCurrentA),
      driverRequirement: DRIVER_REQUIREMENT[params.motorType],
      // Speed and torque come from nameplate figures under no load; real
      // output depends on the built machine and must be measured.
      epistemicState: 'ESTIMATED',
    };
  },

  exposeCapabilities(_params, metrics) {
    return {
      'motor.count': 1,
      'motion.present': true,
      'motor.speedMps': metrics.speedMps,
      'motor.torqueNcm': metrics.effectiveTorqueNcm,
      'motor.rpm': metrics.effectiveRpm,
    };
  },

  exposeRequirements(params, metrics) {
    return {
      'power.voltageV': params.ratedVoltageV,
      'power.currentA': params.stallCurrentA,
      'power.loadW': metrics.powerConsumptionW,
      'driver.type': metrics.driverRequirement,
    };
  },

  validate(params, ctx) {
    const results: ConstraintResult[] = [];

    const supplyV = readNumber(ctx.upstream, 'power.voltageV');
    if (supplyV === undefined) {
      if (ctx.upstreamNodes.length > 0) {
        results.push({
          code: 'motor.supply-unknown',
          severity: 'warning',
          message: 'Upstream supply voltage is unknown; motor drive is unverified.',
        });
      }
    } else if (round(supplyV) > round(params.ratedVoltageV * OVERVOLTAGE_MARGIN)) {
      results.push({
        code: 'motor.overvoltage',
        severity: 'error',
        message:
          `Supply is ${round(supplyV, 2)} V against a ${params.ratedVoltageV} V rating. ` +
          'Speed control or a lower-voltage pack is required.',
      });
    } else if (round(supplyV) < round(params.ratedVoltageV * UNDERVOLTAGE_MARGIN)) {
      results.push({
        code: 'motor.undervoltage',
        severity: 'warning',
        message:
          `Supply is ${round(supplyV, 2)} V against a ${params.ratedVoltageV} V rating; ` +
          'torque and speed will fall below the figures shown.',
      });
    }

    const supplyMaxCurrentA = readNumber(ctx.upstream, 'power.maxCurrentA');
    if (supplyMaxCurrentA !== undefined && params.stallCurrentA > supplyMaxCurrentA) {
      results.push({
        code: 'motor.stall-current-exceeds-supply',
        severity: 'error',
        message:
          `Stall current ${params.stallCurrentA} A exceeds the ` +
          `${round(supplyMaxCurrentA, 2)} A the pack can deliver.`,
      });
    }

    if (params.motorType === 'dc-brushed' && !hasUpstreamControl(ctx)) {
      results.push({
        code: 'motor.no-driver',
        severity: 'warning',
        message: 'A brushed motor needs an H-bridge driver stage; none is connected.',
      });
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

function hasUpstreamControl(ctx: { nodeId: string; graph: { connections: readonly { to: string; type: string }[] } }): boolean {
  return ctx.graph.connections.some(c => c.to === ctx.nodeId && c.type === 'control');
}
