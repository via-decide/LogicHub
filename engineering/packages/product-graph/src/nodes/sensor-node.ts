import { SensorParamsSchema, type SensorParams } from '../schemas/node-params.schema.js';
import {
  round,
  readNumber,
  type ConnectionSpec,
  type ConstraintResult,
  type NodePlugin,
  type ParameterBound,
} from './node-plugin.js';

/** GPIO/bus lines each interface family consumes on the controller. */
const INTERFACE_PIN_COST: Record<SensorParams['interfaceType'], number> = {
  gpio: 2,
  adc: 1,
  i2c: 2,
  spi: 4,
  uart: 2,
};

const CONNECTIONS: readonly ConnectionSpec[] = [
  { type: 'power', direction: 'in', label: 'Power in' },
  { type: 'data', direction: 'out', label: 'Data out' },
];

const BOUNDS: readonly ParameterBound[] = [
  { parameter: 'currentDrawMa', min: 0, max: 200 },
];

export const SensorNode: NodePlugin<SensorParams> = {
  nodeType: 'sensor',
  category: 'hardware',
  defaultParameters: SensorParamsSchema.parse({}),

  parseParameters(raw) {
    return SensorParamsSchema.parse(raw);
  },

  deriveMetrics(params) {
    return {
      sensorType: params.sensorType,
      interfaceType: params.interfaceType,
      pinCost: INTERFACE_PIN_COST[params.interfaceType],
      currentDrawMa: params.currentDrawMa,
      // Sensing supply is assumed at logic level; a real bring-up must confirm.
      powerLoadW: round((3.3 * params.currentDrawMa) / 1000),
      epistemicState: 'ESTIMATED',
    };
  },

  exposeCapabilities(params) {
    return {
      'sensor.count': 1,
      [`sensor.${params.sensorType}`]: true,
      'sensing.present': true,
    };
  },

  exposeRequirements(params, metrics) {
    return {
      'power.loadW': metrics.powerLoadW,
      'controller.pinsNeeded': INTERFACE_PIN_COST[params.interfaceType],
    };
  },

  validate(params, ctx) {
    const results: ConstraintResult[] = [];
    const gpioAvailable = readNumber(ctx.upstream, 'controller.gpioAvailable');
    const needed = INTERFACE_PIN_COST[params.interfaceType];
    if (gpioAvailable !== undefined && needed > gpioAvailable) {
      results.push({
        code: 'sensor.insufficient-pins',
        severity: 'error',
        message: `${params.interfaceType} needs ${needed} lines but only ${gpioAvailable} remain.`,
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
