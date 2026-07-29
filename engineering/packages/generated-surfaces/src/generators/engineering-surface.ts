import type { ProductGraph } from '@logichub-engineering/product-graph';
import { permissionsFor } from '../schemas/authority.schema.js';
import type {
  GeneratedSurface,
  SurfaceAlert,
  SurfaceControl,
  SurfaceReadout,
  SurfaceSection,
} from '../schemas/surface.schema.js';
import { epistemicOf, numberMetric, sortedNodes } from './shared.js';

/**
 * The engineering surface: configure components, map pins, inspect the power
 * arithmetic, and read validation results. It can change the design but
 * cannot flash the device or replace parts — those belong to service.
 */
export function generateEngineeringSurface(graph: ProductGraph): GeneratedSurface {
  const nodes = sortedNodes(graph);
  const alerts: SurfaceAlert[] = [];

  const componentControls: SurfaceControl[] = [];
  const pinControls: SurfaceControl[] = [];
  const powerReadouts: SurfaceReadout[] = [];
  const validationReadouts: SurfaceReadout[] = [];
  const calculationReadouts: SurfaceReadout[] = [];

  for (const node of nodes) {
    // Every parameter is editable here, which is what separates this surface
    // from the operator's.
    for (const key of Object.keys(node.parameters).sort()) {
      if (key === 'sourceComponentId') continue;
      componentControls.push({
        id: `${node.id}.${key}`,
        sourceNodeId: node.id,
        kind: 'field',
        label: `${node.type} · ${key}`,
        requiresPermission: 'config.write',
        firmwareInterlockRequired: true,
      });
    }

    if (node.type === 'controller') {
      const assigned = node.parameters.assignedPins;
      if (assigned !== null && typeof assigned === 'object') {
        for (const fn of Object.keys(assigned as Record<string, unknown>).sort()) {
          pinControls.push({
            id: `${node.id}.pin.${fn}`,
            sourceNodeId: node.id,
            kind: 'field',
            label: `Pin for ${fn}`,
            requiresPermission: 'pinmap.write',
            firmwareInterlockRequired: true,
          });
        }
      }
    }

    if (node.type === 'battery') {
      for (const [key, label, unit] of [
        ['nominalVoltageV', 'Pack voltage', 'V'],
        ['storedEnergyWh', 'Stored energy', 'Wh'],
        ['peakCurrentA', 'Peak current', 'A'],
        ['totalLoadW', 'Total connected load', 'W'],
        ['estimatedRuntimeH', 'Estimated runtime', 'h'],
      ] as const) {
        const value = numberMetric(node, key);
        powerReadouts.push({
          id: `${node.id}.${key}`,
          sourceNodeId: node.id,
          label,
          unit,
          ...(value === undefined ? {} : { value }),
          // A figure the graph could not resolve is shown as unknown rather
          // than as a zero, and a figure resting on estimated downstream draw
          // is labelled as the estimate it is rather than as a calculation.
          epistemicState: value === undefined
            ? 'UNKNOWN'
            : powerEpistemicState(node, key),
        });
      }
    }

    for (const key of Object.keys(node.derivedMetrics).sort()) {
      if (key === 'epistemicState') continue;
      const raw = node.derivedMetrics[key];
      if (raw === undefined) continue;
      calculationReadouts.push({
        id: `${node.id}.metric.${key}`,
        sourceNodeId: node.id,
        label: `${node.type} · ${key}`,
        unit: '',
        value: raw,
        epistemicState: epistemicOf(node),
      });
    }

    for (const constraint of node.constraints) {
      validationReadouts.push({
        id: `${node.id}.constraint.${constraint}`,
        sourceNodeId: node.id,
        label: constraint,
        unit: '',
        value: true,
        epistemicState: 'CALCULATED',
      });
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
      id: 'components',
      title: 'Component configuration',
      requiresPermission: 'config.write',
      controls: componentControls,
      readouts: [],
      emptyReason: componentControls.length === 0 ? 'This product has no components yet.' : null,
    },
    {
      id: 'pinmap',
      title: 'Pin mapping',
      requiresPermission: 'pinmap.write',
      controls: pinControls,
      readouts: [],
      emptyReason: pinControls.length === 0 ? 'No controller pins have been assigned.' : null,
    },
    {
      id: 'power',
      title: 'Power calculations',
      requiresPermission: 'config.read',
      controls: [],
      readouts: powerReadouts,
      emptyReason: powerReadouts.length === 0 ? 'This product has no power source.' : null,
    },
    {
      id: 'calculations',
      title: 'Derived values',
      requiresPermission: 'config.read',
      controls: [],
      readouts: calculationReadouts,
      emptyReason: calculationReadouts.length === 0 ? 'Nothing has been calculated yet.' : null,
    },
    {
      id: 'thermal',
      title: 'Thermal limits',
      requiresPermission: 'validation.read',
      controls: [],
      readouts: [],
      // No thermal model runs in this release. The section exists so its
      // absence is visible, rather than being filled with invented headroom.
      emptyReason:
        'No thermal model has been run for this product, so no thermal limits are known.',
    },
    {
      id: 'simulation',
      title: 'Simulation',
      requiresPermission: 'simulation.run',
      controls: [],
      readouts: [],
      emptyReason:
        'No simulation has been run. Derived values shown elsewhere are calculated or '
        + 'estimated from component figures, and are not simulation results.',
    },
    {
      id: 'validation',
      title: 'Validation results',
      requiresPermission: 'validation.read',
      controls: [],
      readouts: validationReadouts,
      emptyReason: validationReadouts.length === 0
        ? 'No constraint is currently violated. This is not a statement that the design has '
          + 'been validated against hardware.'
        : null,
    },
  ];

  return {
    authority: 'engineering',
    name: `${graph.name} — Engineering`,
    sourceGraphId: graph.id,
    permissions: [...permissionsFor('engineering')],
    sections,
    alerts,
    offline: {
      linkAvailable: false,
      policy: 'read-only',
      description:
        'The engineering surface works on the stored graph. Without a link it stays fully '
        + 'usable for design work; nothing it changes reaches hardware until firmware is '
        + 'built and flashed by service.',
    },
  };
}

/**
 * Total load and runtime are both derived from downstream draw figures that
 * are themselves estimates, so they inherit that weaker standing rather than
 * the node's own calculated state.
 */
const ESTIMATE_DERIVED_KEYS = new Set(['totalLoadW', 'estimatedRuntimeH']);

function powerEpistemicState(
  node: Parameters<typeof epistemicOf>[0],
  key: string,
): ReturnType<typeof epistemicOf> {
  if (!ESTIMATE_DERIVED_KEYS.has(key)) return epistemicOf(node);
  const declared = node.derivedMetrics.runtimeEpistemicState;
  return declared === 'ESTIMATED' ? 'ESTIMATED' : epistemicOf(node);
}

export interface RevisionDifference {
  nodeId: string;
  field: string;
  before: string;
  after: string;
}

/**
 * Compare two revisions of the same product, reporting what actually changed.
 * Nodes added or removed are reported as such rather than as value changes.
 */
export function compareRevisions(before: ProductGraph, after: ProductGraph): RevisionDifference[] {
  const differences: RevisionDifference[] = [];
  const beforeById = new Map(before.nodes.map(n => [n.id, n]));
  const afterById = new Map(after.nodes.map(n => [n.id, n]));

  const allIds = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort();

  for (const id of allIds) {
    const a = beforeById.get(id);
    const b = afterById.get(id);

    if (a === undefined) {
      differences.push({ nodeId: id, field: 'node', before: 'absent', after: b!.type });
      continue;
    }
    if (b === undefined) {
      differences.push({ nodeId: id, field: 'node', before: a.type, after: 'absent' });
      continue;
    }

    const keys = [...new Set([
      ...Object.keys(a.derivedMetrics),
      ...Object.keys(b.derivedMetrics),
    ])].sort();

    for (const key of keys) {
      const av = a.derivedMetrics[key];
      const bv = b.derivedMetrics[key];
      if (av === bv) continue;
      differences.push({
        nodeId: id,
        field: key,
        before: av === undefined ? 'unknown' : String(av),
        after: bv === undefined ? 'unknown' : String(bv),
      });
    }
  }

  return differences;
}
