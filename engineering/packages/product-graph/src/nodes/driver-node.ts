import {
  DriverParamsSchema,
  type DriverParams,
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
 * The driver stage between the pack and the motors.
 *
 * Until now the motor plugin warned that a brushed motor "needs an H-bridge
 * driver stage" and there was no node that could be one, so the warning could
 * never be answered. The kit catalogue has carried a TB6612-class part since
 * Gate 4 while the graph had nowhere to put it.
 *
 * The stage exists here mainly because it dissipates. A driver is where the
 * motor current turns into heat, and thermal margin cannot be assessed for a
 * product whose main dissipating part is not in the model.
 */

/**
 * Both sides of an H-bridge channel conduct in series with the motor, so the
 * conducting resistance a channel presents is twice R_DS(on).
 *
 * A low-side switch has one device in the path, and a stepper driver's two
 * phases each look like a bridge — the multipliers below say which is which
 * rather than treating them all the same.
 */
const CONDUCTING_DEVICES: Record<DriverParams['driverFamily'], number> = {
  'h-bridge': 2,
  'stepper-driver': 2,
  'low-side-switch': 1,
};

/** Supply tolerance is taken from the part's own declared window, not a margin. */
const CONNECTIONS: readonly ConnectionSpec[] = [
  { type: 'power', direction: 'in', label: 'Motor supply in' },
  { type: 'control', direction: 'in', label: 'Logic in' },
  { type: 'power', direction: 'out', label: 'Motor output' },
  { type: 'control', direction: 'out', label: 'Motor control out' },
];

const BOUNDS: readonly ParameterBound[] = [
  { parameter: 'channels', min: 1, max: 4 },
  { parameter: 'rdsOnMilliohm', min: 5, max: 2000 },
  { parameter: 'logicVoltageV', min: 1.8, max: 5.5 },
  { parameter: 'maxContinuousCurrentA', min: 0.1, max: 5 },
];

export const DriverNode: NodePlugin<DriverParams> = {
  nodeType: 'driver',
  category: 'hardware',
  defaultParameters: DriverParamsSchema.parse({}),

  parseParameters(raw) {
    return DriverParamsSchema.parse(raw);
  },

  deriveMetrics(params, ctx) {
    const { drivenCurrentA, drivenMotorCount, currentBasis } = resolveDrivenCurrent(params, ctx);

    const devices = CONDUCTING_DEVICES[params.driverFamily];
    const rdsOnOhm = params.rdsOnMilliohm / 1000;

    // P = I^2 * R, per conducting device, summed over the channels in use.
    const perChannelW = drivenCurrentA === undefined
      ? undefined
      : drivenCurrentA * drivenCurrentA * rdsOnOhm * devices;

    const channelsInUse = drivenMotorCount === 0
      ? 0
      : Math.min(drivenMotorCount, params.channels);

    const conductionW = perChannelW === undefined
      ? undefined
      : round(perChannelW * channelsInUse);

    const quiescentW = round((params.quiescentCurrentMa / 1000) * params.logicVoltageV);

    const metrics: Record<string, MetricValue> = {
      driverFamily: params.driverFamily,
      channels: params.channels,
      channelsInUse,
      conductingDevicesPerChannel: devices,
      quiescentDissipationW: quiescentW,
      maxContinuousCurrentA: params.maxContinuousCurrentA,
      thermalResistanceClass: params.thermalResistanceClass,
      // How the current used for the loss figure was arrived at. 'downstream'
      // means a motor published one; 'none' means nothing did, and then there
      // is no dissipation figure at all rather than a zero.
      currentBasis,
      epistemicState: 'ESTIMATED',
    };

    if (drivenCurrentA !== undefined) metrics.drivenCurrentA = round(drivenCurrentA);
    if (conductionW !== undefined) {
      metrics.conductionDissipationW = conductionW;
      metrics.dissipationW = round(conductionW + quiescentW);
    }

    if (params.thermalResistanceKPerW !== undefined) {
      metrics.thermalResistanceKPerW = params.thermalResistanceKPerW;
    }

    return metrics;
  },

  exposeCapabilities(params, metrics) {
    const capabilities: Record<string, unknown> = {
      'driver.present': true,
      'driver.channels': params.channels,
      [`driver.${params.driverFamily}`]: true,
      'driver.maxContinuousCurrentA': params.maxContinuousCurrentA,
    };

    // Only published when it exists. A dissipation of zero would read as a part
    // that runs cold, which is a different claim from one nobody computed.
    if (typeof metrics.dissipationW === 'number') {
      capabilities['driver.dissipationW'] = metrics.dissipationW;
    }
    if (typeof metrics.thermalResistanceKPerW === 'number') {
      capabilities['driver.thermalResistanceKPerW'] = metrics.thermalResistanceKPerW;
      capabilities['driver.thermalResistanceClass'] = params.thermalResistanceClass;
    }

    return capabilities;
  },

  exposeRequirements(params, metrics) {
    const requirements: Record<string, unknown> = {
      'power.voltageV': params.supplyVoltageMinV,
      'driver.type': params.driverFamily,
    };

    // The stage draws what it passes through, plus its own quiescent draw.
    if (typeof metrics.drivenCurrentA === 'number') {
      requirements['power.currentA'] = round(
        metrics.drivenCurrentA * Number(metrics.channelsInUse) + params.quiescentCurrentMa / 1000,
      );
    }

    return requirements;
  },

  validate(params, ctx) {
    const results: ConstraintResult[] = [];

    if (params.supplyVoltageMinV > params.supplyVoltageMaxV) {
      results.push({
        code: 'driver.supply-window-inverted',
        severity: 'error',
        message:
          `Declared supply window ${params.supplyVoltageMinV}–${params.supplyVoltageMaxV} V `
          + 'has its minimum above its maximum.',
      });
    }

    const supplyV = readNumber(ctx.upstream, 'power.voltageV');
    if (supplyV === undefined) {
      if (ctx.upstreamNodes.length > 0) {
        results.push({
          code: 'driver.supply-unknown',
          severity: 'warning',
          message: 'Upstream supply voltage is unknown; the driver window cannot be checked.',
        });
      }
    } else if (round(supplyV) > round(params.supplyVoltageMaxV)) {
      results.push({
        code: 'driver.overvoltage',
        severity: 'error',
        message:
          `Supply is ${round(supplyV, 2)} V against a ${params.supplyVoltageMaxV} V maximum.`,
      });
    } else if (round(supplyV) < round(params.supplyVoltageMinV)) {
      results.push({
        code: 'driver.undervoltage',
        severity: 'error',
        message:
          `Supply is ${round(supplyV, 2)} V, below the ${params.supplyVoltageMinV} V the `
          + 'driver needs to switch.',
      });
    }

    const { drivenCurrentA, drivenMotorCount } = resolveDrivenCurrent(params, ctx);

    if (drivenMotorCount > params.channels) {
      results.push({
        code: 'driver.channels-exceeded',
        severity: 'error',
        message:
          `${drivenMotorCount} motors are connected to a ${params.channels}-channel driver.`,
      });
    }

    if (drivenCurrentA !== undefined && drivenCurrentA > params.maxContinuousCurrentA) {
      results.push({
        code: 'driver.current-exceeded',
        severity: 'error',
        message:
          `A driven motor draws ${round(drivenCurrentA, 2)} A against a `
          + `${params.maxContinuousCurrentA} A continuous rating.`,
      });
    }

    if (params.thermalResistanceClass === 'unknown') {
      results.push({
        code: 'driver.thermal-resistance-unknown',
        severity: 'info',
        message:
          'Junction-to-ambient thermal resistance is not declared, so no temperature '
          + 'can be estimated for this stage. This is not a pass.',
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

/**
 * The current the driver actually carries, taken from the motors below it.
 *
 * A driver on its own carries nothing, and that is reported as an absent
 * current rather than as zero amps — the difference matters, because zero amps
 * would make the stage look cool when in fact nothing has been worked out.
 *
 * The typical running draw is used rather than the stall figure. Stall is the
 * worst case for the supply, but a driver sized on a stall that lasts a moment
 * would be enormous; the continuous rating is what the running current tests.
 */
function resolveDrivenCurrent(
  params: DriverParams,
  ctx: NodeContext,
): { drivenCurrentA: number | undefined; drivenMotorCount: number; currentBasis: string } {
  const motors = ctx.downstreamNodes.filter(node => node.type === 'motor');

  if (motors.length === 0) {
    return { drivenCurrentA: undefined, drivenMotorCount: 0, currentBasis: 'none' };
  }

  // The heaviest motor sets the per-channel figure; channels are independent.
  let worst: number | undefined;
  for (const motor of motors) {
    const typical = readNumber(motor.derivedMetrics, 'typicalCurrentA');
    if (typical === undefined) continue;
    worst = worst === undefined ? typical : Math.max(worst, typical);
  }

  if (worst === undefined) {
    // Motors are attached but none has published a current yet. On the first
    // propagation pass this is normal; it must not become zero.
    return { drivenCurrentA: undefined, drivenMotorCount: motors.length, currentBasis: 'pending' };
  }

  void params;
  return { drivenCurrentA: worst, drivenMotorCount: motors.length, currentBasis: 'downstream' };
}
