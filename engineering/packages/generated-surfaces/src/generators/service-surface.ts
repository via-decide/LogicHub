import type { ProductGraph } from '@logichub-engineering/product-graph';
import { permissionsFor } from '../schemas/authority.schema.js';
import type {
  GeneratedSurface,
  SurfaceAlert,
  SurfaceControl,
  SurfaceReadout,
  SurfaceSection,
} from '../schemas/surface.schema.js';
import type { FaultCode, MaintenanceEntry, SelfTest } from '../schemas/diagnostics.schema.js';
import { FAULT_CODES, SELF_TESTS } from '../diagnostics/self-tests.js';
import { sortedNodes } from './shared.js';

export interface ServiceSurfaceOptions {
  /**
   * Maintenance already recorded for this unit. It defaults to empty: a newly
   * generated surface has no history, and none is invented for it.
   */
  maintenanceHistory?: readonly MaintenanceEntry[];
}

/**
 * The service surface: diagnose faults, run self-tests, replace parts,
 * recalibrate, flash firmware, and record what was done with evidence. It
 * cannot redesign the product and does not drive it as an operator would.
 */
export function generateServiceSurface(
  graph: ProductGraph,
  options: ServiceSurfaceOptions = {},
): GeneratedSurface {
  const nodes = sortedNodes(graph);
  const presentTypes = new Set(nodes.map(n => n.type));
  const history = options.maintenanceHistory ?? [];

  const applicableFaults: FaultCode[] = FAULT_CODES
    .filter(f => presentTypes.has(f.appliesToNodeType))
    .map(f => ({ ...f }));

  const applicableTests: SelfTest[] = SELF_TESTS
    .filter(t => presentTypes.has(t.appliesToNodeType))
    .map(t => ({ ...t }));

  const faultReadouts: SurfaceReadout[] = applicableFaults.map(fault => ({
    id: `fault.${fault.code}`,
    sourceNodeId: firstNodeOfType(nodes, fault.appliesToNodeType) ?? fault.appliesToNodeType,
    label: `${fault.code} — ${fault.title}`,
    unit: '',
    epistemicState: 'UNKNOWN',
  }));

  const selfTestControls: SurfaceControl[] = applicableTests.map(test => ({
    id: `selftest.${test.id}`,
    sourceNodeId: firstNodeOfType(nodes, test.appliesToNodeType) ?? test.appliesToNodeType,
    kind: 'button',
    label: `Run ${test.name}`,
    requiresPermission: 'diagnostics.run',
    firmwareInterlockRequired: true,
  }));

  const replacementControls: SurfaceControl[] = nodes
    .filter(n => n.type !== 'operator-app')
    .map(node => ({
      id: `replace.${node.id}`,
      sourceNodeId: node.id,
      kind: 'button' as const,
      label: `Replace ${node.type}`,
      requiresPermission: 'component.replace' as const,
      firmwareInterlockRequired: true as const,
    }));

  const calibrationControls: SurfaceControl[] = nodes
    .filter(n => n.type === 'sensor' || n.type === 'motor')
    .map(node => ({
      id: `calibrate.${node.id}`,
      sourceNodeId: node.id,
      kind: 'button' as const,
      label: `Calibrate ${node.type}`,
      requiresPermission: 'calibration.write' as const,
      firmwareInterlockRequired: true as const,
    }));

  const firmwareControls: SurfaceControl[] = nodes
    .filter(n => n.type === 'controller')
    .map(node => ({
      id: `flash.${node.id}`,
      sourceNodeId: node.id,
      kind: 'button' as const,
      label: 'Flash firmware',
      requiresPermission: 'firmware.flash' as const,
      firmwareInterlockRequired: true as const,
    }));

  const historyReadouts: SurfaceReadout[] = history.map(entry => ({
    id: `maintenance.${entry.id}`,
    sourceNodeId: entry.componentId ?? 'unit',
    label: entry.action,
    unit: '',
    value: entry.recordedAt,
    // A recorded action is evidence of what was done, not of an outcome.
    epistemicState: 'MEASURED',
  }));

  const alerts: SurfaceAlert[] = [];
  for (const node of nodes) {
    for (const constraint of node.constraints) {
      alerts.push({
        id: `${node.id}.${constraint}`,
        sourceNodeId: node.id,
        severity: 'error',
        message: constraint,
      });
    }
  }

  const sections: SurfaceSection[] = [
    {
      id: 'faults',
      title: 'Fault codes',
      requiresPermission: 'diagnostics.run',
      controls: [],
      readouts: faultReadouts,
      emptyReason: faultReadouts.length === 0
        ? 'No fault code applies to the parts in this product.'
        : null,
    },
    {
      id: 'self-tests',
      title: 'Self-tests',
      requiresPermission: 'diagnostics.run',
      controls: selfTestControls,
      readouts: [],
      emptyReason: selfTestControls.length === 0
        ? 'No self-test applies to the parts in this product.'
        : null,
    },
    {
      id: 'replacement',
      title: 'Component replacement',
      requiresPermission: 'component.replace',
      controls: replacementControls,
      readouts: [],
      emptyReason: replacementControls.length === 0 ? 'This product has no parts to replace.' : null,
    },
    {
      id: 'calibration',
      title: 'Calibration',
      requiresPermission: 'calibration.write',
      controls: calibrationControls,
      readouts: [],
      emptyReason: calibrationControls.length === 0
        ? 'Nothing in this product is calibrated.'
        : null,
    },
    {
      id: 'firmware',
      title: 'Firmware update',
      requiresPermission: 'firmware.flash',
      controls: firmwareControls,
      readouts: [],
      emptyReason: firmwareControls.length === 0 ? 'This product has no controller to flash.' : null,
    },
    {
      id: 'maintenance',
      title: 'Maintenance history',
      requiresPermission: 'maintenance.read',
      controls: [],
      readouts: historyReadouts,
      // A newly generated surface has no history. Nothing is invented to
      // fill the space.
      emptyReason: historyReadouts.length === 0
        ? 'No maintenance has been recorded for this unit.'
        : null,
    },
    {
      id: 'evidence',
      title: 'Evidence capture',
      requiresPermission: 'evidence.capture',
      controls: [{
        id: 'evidence.capture',
        sourceNodeId: 'unit',
        kind: 'button',
        label: 'Capture evidence',
        requiresPermission: 'evidence.capture',
        firmwareInterlockRequired: true,
      }],
      readouts: [],
      emptyReason: null,
    },
  ];

  return {
    authority: 'service',
    name: `${graph.name} — Service`,
    sourceGraphId: graph.id,
    permissions: [...permissionsFor('service')],
    sections,
    alerts,
    offline: {
      linkAvailable: false,
      policy: 'read-only',
      description:
        'Service works with the unit in hand. Procedures and history stay readable without '
        + 'a link; results recorded offline sync when a link returns.',
    },
  };
}

function firstNodeOfType(
  nodes: readonly { id: string; type: string }[],
  nodeType: string,
): string | undefined {
  return nodes.find(n => n.type === nodeType)?.id;
}
