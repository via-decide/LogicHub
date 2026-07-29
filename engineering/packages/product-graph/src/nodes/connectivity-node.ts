import {
  ConnectivityParamsSchema,
  type ConnectivityParams,
} from '../schemas/node-params.schema.js';
import {
  round,
  readBoolean,
  type ConnectionSpec,
  type ConstraintResult,
  type NodePlugin,
  type ParameterBound,
} from './node-plugin.js';

/** Typical transmit-average current per link type, in milliamps. ESTIMATED. */
const LINK_CURRENT_MA: Record<ConnectivityParams['connectivityType'], number> = {
  bluetooth: 15,
  wifi: 90,
  radio: 25,
};

const CONNECTIONS: readonly ConnectionSpec[] = [
  { type: 'data', direction: 'in', label: 'Data in' },
  { type: 'data', direction: 'out', label: 'Link out' },
];

const BOUNDS: readonly ParameterBound[] = [
  { parameter: 'rangeMEstimate', min: 1, max: 100 },
];

export const ConnectivityNode: NodePlugin<ConnectivityParams> = {
  nodeType: 'connectivity',
  category: 'interface',
  defaultParameters: ConnectivityParamsSchema.parse({}),

  parseParameters(raw) {
    return ConnectivityParamsSchema.parse(raw);
  },

  deriveMetrics(params) {
    const currentMa = LINK_CURRENT_MA[params.connectivityType];
    return {
      connectivityType: params.connectivityType,
      currentDrawMa: currentMa,
      powerLoadW: round((3.3 * currentMa) / 1000),
      // Range is a line-of-sight estimate; enclosures and obstacles reduce it.
      rangeMEstimate: params.rangeMEstimate,
      epistemicState: 'ESTIMATED',
    };
  },

  exposeCapabilities(params) {
    return {
      'link.present': true,
      'wireless.any': true,
      [`wireless.${params.connectivityType}`]: true,
      'link.rangeM': params.rangeMEstimate,
    };
  },

  exposeRequirements(_params, metrics) {
    return {
      'power.loadW': metrics.powerLoadW,
      'compute.required': true,
    };
  },

  validate(params, ctx) {
    const results: ConstraintResult[] = [];
    const hasCompute = readBoolean(ctx.upstream, 'compute.present');
    if (hasCompute !== true) {
      results.push({
        code: 'connectivity.no-host',
        severity: 'warning',
        message: `A ${params.connectivityType} link needs a controller to drive it; none is connected upstream.`,
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
