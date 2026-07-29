import type { LogicNode, ProductGraph } from '@logichub-engineering/product-graph';
import { aggregateCapabilities } from '@logichub-engineering/product-graph';
import { permissionsFor } from '../schemas/authority.schema.js';
import type {
  GeneratedSurface,
  SurfaceAlert,
  SurfaceControl,
  SurfaceReadout,
  SurfaceSection,
} from '../schemas/surface.schema.js';
import { epistemicOf, sortedNodes, numberMetric, stringMetric } from './shared.js';

/**
 * The operator surface: drive the product, watch it, and be told when
 * something is wrong. It holds no authority to reconfigure, recalibrate, or
 * flash anything, and every control it offers stays subject to the firmware
 * interlocks.
 */
export function generateOperatorSurface(graph: ProductGraph): GeneratedSurface {
  const nodes = sortedNodes(graph);
  const controls: SurfaceControl[] = [];
  const readouts: SurfaceReadout[] = [];
  const alerts: SurfaceAlert[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'motor': {
        const maxRpm = numberMetric(node, 'effectiveRpm');
        controls.push({
          id: `${node.id}.speed`,
          sourceNodeId: node.id,
          kind: 'slider',
          label: 'Speed',
          min: 0,
          ...(maxRpm === undefined ? {} : { max: maxRpm }),
          unit: 'rpm',
          requiresPermission: 'control.actuate',
          firmwareInterlockRequired: true,
        });
        controls.push({
          id: `${node.id}.direction`,
          sourceNodeId: node.id,
          kind: 'toggle',
          label: 'Direction',
          requiresPermission: 'control.actuate',
          firmwareInterlockRequired: true,
        });
        readouts.push({
          id: `${node.id}.speed`,
          sourceNodeId: node.id,
          label: 'Motor speed',
          unit: 'rpm',
          epistemicState: epistemicOf(node),
        });
        break;
      }

      case 'controller':
        controls.push({
          id: `${node.id}.stop`,
          sourceNodeId: node.id,
          kind: 'button',
          label: 'Stop',
          requiresPermission: 'control.actuate',
          firmwareInterlockRequired: true,
        });
        break;

      case 'battery': {
        readouts.push({
          id: `${node.id}.voltage`,
          sourceNodeId: node.id,
          label: 'Pack voltage',
          unit: 'V',
          ...maybeValue(numberMetric(node, 'nominalVoltageV')),
          epistemicState: epistemicOf(node),
        });
        if (node.derivedMetrics.runtimeKnown === true) {
          readouts.push({
            id: `${node.id}.runtime`,
            sourceNodeId: node.id,
            label: 'Estimated runtime',
            unit: 'h',
            ...maybeValue(numberMetric(node, 'estimatedRuntimeH')),
            // Runtime rests on estimated downstream draw, and says so.
            epistemicState: stringMetric(node, 'runtimeEpistemicState') === 'ESTIMATED'
              ? 'ESTIMATED'
              : epistemicOf(node),
          });
        } else {
          readouts.push({
            id: `${node.id}.runtime`,
            sourceNodeId: node.id,
            label: 'Estimated runtime',
            unit: 'h',
            epistemicState: 'UNKNOWN',
          });
        }
        alerts.push({
          id: `${node.id}.low-charge`,
          sourceNodeId: node.id,
          severity: 'warning',
          message: 'Pack voltage low',
        });
        break;
      }

      case 'sensor':
        readouts.push({
          id: `${node.id}.reading`,
          sourceNodeId: node.id,
          label: `${stringMetric(node, 'sensorType') ?? 'Sensor'} reading`,
          unit: sensorUnit(stringMetric(node, 'sensorType')),
          epistemicState: epistemicOf(node),
        });
        break;

      default:
        break;
    }

    for (const constraint of node.constraints) {
      alerts.push({
        id: `${node.id}.${constraint}`,
        sourceNodeId: node.id,
        severity: 'error',
        message: constraint,
      });
    }
  }

  const capabilities = aggregateCapabilities(graph);
  const linkAvailable = capabilities['wireless.any'] === true;

  const sections: SurfaceSection[] = [
    {
      id: 'controls',
      title: 'Controls',
      requiresPermission: 'control.actuate',
      controls,
      readouts: [],
      emptyReason: controls.length === 0 ? 'Nothing in this product can be driven.' : null,
    },
    {
      id: 'status',
      title: 'Status',
      requiresPermission: 'status.read',
      controls: [],
      readouts,
      emptyReason: readouts.length === 0 ? 'No node in this product reports a value.' : null,
    },
  ];

  return {
    authority: 'operator',
    name: `${graph.name} — Operator`,
    sourceGraphId: graph.id,
    permissions: [...permissionsFor('operator')],
    sections,
    alerts,
    offline: linkAvailable
      ? {
        linkAvailable: true,
        policy: 'last-known-state',
        description:
          'When the link drops, the last known values stay on screen, marked stale, and '
          + 'controls stop accepting input until the link returns.',
      }
      : {
        linkAvailable: false,
        policy: 'no-link',
        description:
          'This product has no wireless link, so the operator surface has no way to reach '
          + 'the hardware.',
      },
  };
}

function maybeValue(value: number | undefined): { value?: number } {
  return value === undefined ? {} : { value };
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
