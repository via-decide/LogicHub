import {
  OperatorAppParamsSchema,
  type OperatorAppParams,
} from '../schemas/node-params.schema.js';
import type { LogicNode, ProductGraph } from '../schemas/product-graph.schema.js';
import {
  readBoolean,
  type ConnectionSpec,
  type ConstraintResult,
  type NodeContext,
  type NodePlugin,
  type ParameterBound,
} from './node-plugin.js';

export interface AppControl {
  id: string;
  sourceNodeId: string;
  kind: 'slider' | 'toggle' | 'joystick' | 'button';
  label: string;
  min?: number;
  max?: number;
  unit?: string;
  /**
   * The generated app is a remote surface only. Every control is subject to
   * the interlocks enforced in firmware; the app cannot override or bypass
   * them, and this flag records that the boundary is intentional.
   */
  firmwareInterlockRequired: true;
}

export interface AppTelemetryChannel {
  id: string;
  sourceNodeId: string;
  label: string;
  unit: string;
  epistemicState: string;
}

export interface AppAlert {
  id: string;
  sourceNodeId: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface OperatorAppSchema {
  appName: string;
  controls: AppControl[];
  telemetry: AppTelemetryChannel[];
  alerts: AppAlert[];
  transport: string[];
  offlineCapable: boolean;
}

const CONNECTIONS: readonly ConnectionSpec[] = [
  { type: 'data', direction: 'in', label: 'Telemetry in' },
  { type: 'control', direction: 'out', label: 'Commands out' },
];

const BOUNDS: readonly ParameterBound[] = [];

export const OperatorAppNode: NodePlugin<OperatorAppParams> = {
  nodeType: 'operator-app',
  category: 'interface',
  defaultParameters: OperatorAppParamsSchema.parse({}),

  parseParameters(raw) {
    return OperatorAppParamsSchema.parse(raw);
  },

  deriveMetrics(params, ctx) {
    const schema = generateAppSchema(ctx.graph, params.appName);
    return {
      appName: schema.appName,
      controlCount: schema.controls.length,
      telemetryChannels: schema.telemetry.length,
      alertCount: schema.alerts.length,
      transportCount: schema.transport.length,
      offlineCapable: schema.offlineCapable,
      epistemicState: 'CALCULATED',
    };
  },

  exposeCapabilities(params, metrics) {
    return {
      'app.present': true,
      'app.controlCount': metrics.controlCount,
      'app.telemetryChannels': metrics.telemetryChannels,
      'app.offlineCapable': metrics.offlineCapable,
    };
  },

  exposeRequirements() {
    return { 'wireless.any': true };
  },

  validate(_params, ctx) {
    const results: ConstraintResult[] = [];
    const wireless = readBoolean(ctx.upstream, 'wireless.any');
    if (wireless !== true) {
      results.push({
        code: 'operator-app.no-transport',
        severity: 'warning',
        message: 'No wireless link reaches this app; it will have no way to talk to the hardware.',
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
 * Derive the operator app surface from what the graph actually contains.
 * Nodes are read in stable id order so the same graph always yields the same
 * app schema.
 */
export function generateAppSchema(graph: ProductGraph, appName = 'Operator'): OperatorAppSchema {
  const nodes = [...graph.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const controls: AppControl[] = [];
  const telemetry: AppTelemetryChannel[] = [];
  const alerts: AppAlert[] = [];
  const transport = new Set<string>();

  for (const node of nodes) {
    switch (node.type) {
      case 'motor':
        controls.push({
          id: `${node.id}.speed`,
          sourceNodeId: node.id,
          kind: 'slider',
          label: 'Speed',
          min: 0,
          max: numberMetric(node, 'effectiveRpm') ?? 0,
          unit: 'rpm',
          firmwareInterlockRequired: true,
        });
        controls.push({
          id: `${node.id}.direction`,
          sourceNodeId: node.id,
          kind: 'toggle',
          label: 'Direction',
          firmwareInterlockRequired: true,
        });
        telemetry.push({
          id: `${node.id}.speed`,
          sourceNodeId: node.id,
          label: 'Motor speed',
          unit: 'rpm',
          epistemicState: stringMetric(node, 'epistemicState') ?? 'ESTIMATED',
        });
        break;

      case 'battery':
        telemetry.push({
          id: `${node.id}.voltage`,
          sourceNodeId: node.id,
          label: 'Pack voltage',
          unit: 'V',
          epistemicState: stringMetric(node, 'epistemicState') ?? 'ESTIMATED',
        });
        if (node.derivedMetrics.runtimeKnown === true) {
          telemetry.push({
            id: `${node.id}.runtime`,
            sourceNodeId: node.id,
            label: 'Estimated runtime',
            unit: 'h',
            epistemicState: stringMetric(node, 'runtimeEpistemicState') ?? 'ESTIMATED',
          });
        }
        alerts.push({
          id: `${node.id}.low-charge`,
          sourceNodeId: node.id,
          severity: 'warning',
          message: 'Pack voltage low',
        });
        break;

      case 'sensor':
        telemetry.push({
          id: `${node.id}.reading`,
          sourceNodeId: node.id,
          label: `${stringMetric(node, 'sensorType') ?? 'sensor'} reading`,
          unit: sensorUnit(stringMetric(node, 'sensorType')),
          epistemicState: stringMetric(node, 'epistemicState') ?? 'ESTIMATED',
        });
        break;

      case 'connectivity': {
        const kind = stringMetric(node, 'connectivityType');
        if (kind !== undefined) transport.add(kind);
        break;
      }

      case 'controller': {
        if (node.derivedMetrics.hasBle === true) transport.add('bluetooth');
        if (node.derivedMetrics.hasWifi === true) transport.add('wifi');
        controls.push({
          id: `${node.id}.stop`,
          sourceNodeId: node.id,
          kind: 'button',
          label: 'Stop',
          firmwareInterlockRequired: true,
        });
        break;
      }

      default:
        break;
    }

    // Any constraint the graph has already recorded surfaces as an alert, so
    // the operator sees the same problems the engineering view does.
    for (const constraint of node.constraints) {
      alerts.push({
        id: `${node.id}.${constraint}`,
        sourceNodeId: node.id,
        severity: 'error',
        message: constraint,
      });
    }
  }

  return {
    appName,
    controls,
    telemetry,
    alerts,
    transport: [...transport].sort(),
    // Without a link there is nothing to go offline from; with one, the app
    // still needs a cached last-known state to be useful out of range.
    offlineCapable: transport.size > 0,
  };
}

function numberMetric(node: LogicNode, key: string): number | undefined {
  const raw = node.derivedMetrics[key];
  return typeof raw === 'number' ? raw : undefined;
}

function stringMetric(node: LogicNode, key: string): string | undefined {
  const raw = node.derivedMetrics[key];
  return typeof raw === 'string' ? raw : undefined;
}

function sensorUnit(sensorType: string | undefined): string {
  switch (sensorType) {
    case 'distance': return 'mm';
    case 'temperature': return 'degC';
    case 'light': return 'lux';
    case 'moisture': return '%';
    case 'imu': return 'deg';
    default: return '';
  }
}
