import { describe, it, expect } from 'vitest';
import { updateNodeParameters, propagate } from '@logichub-engineering/product-graph';
import {
  generateAllSurfaces,
  generateOperatorSurface,
  generateEngineeringSurface,
  generateServiceSurface,
  compareRevisions,
} from '../src/generators/index.js';
import { GeneratedSurfaceSchema, SurfaceSetSchema } from '../src/schemas/surface.schema.js';
import { batteryOnlyGraph, roverGraph, unlinkedGraph } from './helpers.js';

function sectionOf(surface: { sections: { id: string }[] }, id: string) {
  const found = surface.sections.find(s => s.id === id);
  if (!found) throw new Error(`No section ${id}`);
  return found as never as {
    id: string; title: string; controls: { id: string; requiresPermission: string }[];
    readouts: { id: string; epistemicState: string; value?: unknown }[]; emptyReason: string | null;
  };
}

describe('Gate 5 — three surfaces from one graph', () => {
  it('derives all three surfaces from the same ProductGraph', () => {
    const graph = roverGraph();
    const surfaces = generateAllSurfaces(graph);

    expect(SurfaceSetSchema.safeParse(surfaces).success).toBe(true);
    expect(surfaces.sourceGraphId).toBe(graph.id);
    for (const surface of [surfaces.operator, surfaces.engineering, surfaces.service]) {
      expect(surface.sourceGraphId).toBe(graph.id);
      expect(GeneratedSurfaceSchema.safeParse(surface).success).toBe(true);
    }
  });

  it('gives the three surfaces distinct authorities and permission sets', () => {
    const { operator, engineering, service } = generateAllSurfaces(roverGraph());
    expect(operator.authority).toBe('operator');
    expect(engineering.authority).toBe('engineering');
    expect(service.authority).toBe('service');

    const sets = [operator, engineering, service].map(s => JSON.stringify([...s.permissions].sort()));
    expect(new Set(sets).size).toBe(3);
  });

  it('produces identical surfaces for the same graph every time', () => {
    const graph = roverGraph();
    const baseline = JSON.stringify(generateAllSurfaces(graph));
    for (let i = 0; i < 10; i += 1) {
      expect(JSON.stringify(generateAllSurfaces(graph))).toBe(baseline);
    }
  });
});

describe('Gate 5 — operator surface', () => {
  it('offers speed and direction for each motor plus a stop', () => {
    const surface = generateOperatorSurface(roverGraph());
    const controls = sectionOf(surface, 'controls').controls;

    expect(controls.filter(c => c.id.endsWith('.speed'))).toHaveLength(2);
    expect(controls.filter(c => c.id.endsWith('.direction'))).toHaveLength(2);
    expect(controls.filter(c => c.id.endsWith('.stop'))).toHaveLength(1);
  });

  it('marks every control as bound by the firmware interlocks', () => {
    const surface = generateOperatorSurface(roverGraph());
    for (const section of surface.sections) {
      for (const control of section.controls) {
        expect(control.firmwareInterlockRequired).toBe(true);
      }
    }
  });

  it('offers no section requiring authority the operator lacks', () => {
    const surface = generateOperatorSurface(roverGraph());
    const permissions = new Set(surface.permissions);
    for (const section of surface.sections) {
      expect(permissions.has(section.requiresPermission)).toBe(true);
    }
  });

  it('shows pack voltage and runtime with their epistemic state', () => {
    const readouts = sectionOf(generateOperatorSurface(roverGraph()), 'status').readouts;
    const voltage = readouts.find(r => r.id === 'n1_battery.voltage')!;
    const runtime = readouts.find(r => r.id === 'n1_battery.runtime')!;

    expect(voltage.value).toBe(3.6);
    expect(voltage.epistemicState).toBe('CALCULATED');
    // Runtime rests on estimated downstream draw, so it is never shown as
    // anything stronger than an estimate.
    expect(runtime.epistemicState).toBe('ESTIMATED');
  });

  it('marks a runtime it cannot resolve as unknown rather than zero', () => {
    // A battery with nothing downstream has no load to divide by.
    const graph = batteryOnlyGraph();
    const readouts = sectionOf(generateOperatorSurface(graph), 'status').readouts;
    const runtime = readouts.find(r => r.id === 'n1_battery.runtime')!;

    expect(runtime.epistemicState).toBe('UNKNOWN');
    expect(runtime.value).toBeUndefined();
  });

  it('keeps the last known state when a link exists', () => {
    const surface = generateOperatorSurface(roverGraph());
    expect(surface.offline.linkAvailable).toBe(true);
    expect(surface.offline.policy).toBe('last-known-state');
  });

  it('says plainly that it cannot reach hardware with no link', () => {
    const surface = generateOperatorSurface(unlinkedGraph());
    expect(surface.offline.linkAvailable).toBe(false);
    expect(surface.offline.policy).toBe('no-link');
    expect(surface.offline.description).toMatch(/no way to reach/);
  });
});

describe('Gate 5 — engineering surface', () => {
  it('exposes every node parameter as an editable field', () => {
    const controls = sectionOf(generateEngineeringSurface(roverGraph()), 'components').controls;
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.requiresPermission).toBe('config.write');
    }
  });

  it('exposes the controller pin map', () => {
    const controls = sectionOf(generateEngineeringSurface(roverGraph()), 'pinmap').controls;
    expect(controls.map(c => c.id)).toContain('n2_controller.pin.motorLeft');
    expect(controls.map(c => c.id)).toContain('n2_controller.pin.motorRight');
  });

  it('reports the power arithmetic', () => {
    const readouts = sectionOf(generateEngineeringSurface(roverGraph()), 'power').readouts;
    const energy = readouts.find(r => r.id === 'n1_battery.storedEnergyWh')!;
    expect(energy.value).toBe(7.2);
  });

  it('marks an unresolved power figure unknown instead of zero', () => {
    const readouts = sectionOf(generateEngineeringSurface(batteryOnlyGraph()), 'power').readouts;
    const runtime = readouts.find(r => r.id === 'n1_battery.estimatedRuntimeH')!;
    expect(runtime.epistemicState).toBe('UNKNOWN');
    expect(runtime.value).toBeUndefined();
  });

  it('labels runtime and total load as estimates, not calculations', () => {
    // Both rest on downstream draw figures that are themselves estimates, so
    // neither may be presented with the pack's own calculated standing.
    const readouts = sectionOf(generateEngineeringSurface(roverGraph()), 'power').readouts;
    expect(readouts.find(r => r.id === 'n1_battery.estimatedRuntimeH')!.epistemicState)
      .toBe('ESTIMATED');
    expect(readouts.find(r => r.id === 'n1_battery.totalLoadW')!.epistemicState)
      .toBe('ESTIMATED');
    // The pack's own arithmetic keeps its stronger standing.
    expect(readouts.find(r => r.id === 'n1_battery.storedEnergyWh')!.epistemicState)
      .toBe('CALCULATED');
  });

  it('does not invent thermal limits it has not computed', () => {
    const thermal = sectionOf(generateEngineeringSurface(roverGraph()), 'thermal');
    expect(thermal.readouts).toEqual([]);
    expect(thermal.emptyReason).toMatch(/No thermal model has been run/);
  });

  it('does not present calculated values as simulation results', () => {
    const simulation = sectionOf(generateEngineeringSurface(roverGraph()), 'simulation');
    expect(simulation.readouts).toEqual([]);
    expect(simulation.emptyReason).toMatch(/No simulation has been run/);
    expect(simulation.emptyReason).toMatch(/are not simulation results/);
  });

  it('does not read a clean constraint list as a validated design', () => {
    const validation = sectionOf(generateEngineeringSurface(roverGraph()), 'validation');
    expect(validation.readouts).toEqual([]);
    expect(validation.emptyReason).toMatch(/not a statement that the design has been validated/);
  });

  it('surfaces constraint violations when they exist', () => {
    const graph = roverGraph();
    const battery = graph.nodes.find(n => n.type === 'battery')!;
    const hot = propagate(
      updateNodeParameters(graph, battery.id, { chemistry: 'lipo', cellCount: 4 }),
    ).graph;

    const validation = sectionOf(generateEngineeringSurface(hot), 'validation');
    expect(validation.readouts.length).toBeGreaterThan(0);
    expect(validation.readouts.map(r => r.id).join(' ')).toMatch(/regulator-required/);
  });

  it('compares two revisions and reports what changed', () => {
    const before = roverGraph();
    const battery = before.nodes.find(n => n.type === 'battery')!;
    const after = propagate(updateNodeParameters(before, battery.id, { capacityMah: 4000 })).graph;

    const differences = compareRevisions(before, after);
    const energy = differences.find(d => d.nodeId === battery.id && d.field === 'storedEnergyWh')!;
    expect(energy.before).toBe('7.2');
    expect(energy.after).toBe('14.4');
  });

  it('reports an added node as added rather than as a value change', () => {
    const before = unlinkedGraph();
    const after = roverGraph();
    const differences = compareRevisions(before, after);
    const added = differences.find(d => d.nodeId === 'n3_motor_left' && d.field === 'node')!;
    expect(added.before).toBe('absent');
    expect(added.after).toBe('motor');
  });

  it('finds no differences between a graph and itself', () => {
    const graph = roverGraph();
    expect(compareRevisions(graph, graph)).toEqual([]);
  });
});

describe('Gate 5 — service surface', () => {
  it('offers only the fault codes that apply to the parts present', () => {
    const readouts = sectionOf(generateServiceSurface(roverGraph()), 'faults').readouts;
    const codes = readouts.map(r => r.id);

    expect(codes).toContain('fault.F-MOT-001');
    expect(codes).toContain('fault.F-BAT-001');
    expect(codes).toContain('fault.F-LNK-001');
  });

  it('withholds fault codes for parts the product does not have', () => {
    const readouts = sectionOf(generateServiceSurface(unlinkedGraph()), 'faults').readouts;
    const codes = readouts.map(r => r.id);

    expect(codes).toContain('fault.F-CTL-001');
    expect(codes).not.toContain('fault.F-MOT-001');
    expect(codes).not.toContain('fault.F-LNK-001');
  });

  it('offers self-tests, replacement, calibration and flashing', () => {
    const surface = generateServiceSurface(roverGraph());
    expect(sectionOf(surface, 'self-tests').controls.length).toBeGreaterThan(0);
    expect(sectionOf(surface, 'replacement').controls.length).toBeGreaterThan(0);
    expect(sectionOf(surface, 'calibration').controls.length).toBeGreaterThan(0);
    expect(sectionOf(surface, 'firmware').controls.map(c => c.id)).toContain('flash.n2_controller');
  });

  it('starts with an empty maintenance history and says so', () => {
    // A newly generated surface has no history, and none is invented for it.
    const maintenance = sectionOf(generateServiceSurface(roverGraph()), 'maintenance');
    expect(maintenance.readouts).toEqual([]);
    expect(maintenance.emptyReason).toMatch(/No maintenance has been recorded/);
  });

  it('shows real maintenance entries when they are supplied', () => {
    const surface = generateServiceSurface(roverGraph(), {
      maintenanceHistory: [{
        id: 'm1',
        recordedAt: '2026-02-01T00:00:00.000Z',
        action: 'Replaced left drive motor',
        componentId: 'n3_motor_left',
        evidenceRefs: ['photo-1'],
      }],
    });

    const maintenance = sectionOf(surface, 'maintenance');
    expect(maintenance.readouts).toHaveLength(1);
    expect(maintenance.emptyReason).toBeNull();
  });

  it('offers evidence capture', () => {
    const evidence = sectionOf(generateServiceSurface(roverGraph()), 'evidence');
    expect(evidence.controls.map(c => c.requiresPermission)).toContain('evidence.capture');
  });

  it('does not offer to replace the operator app, which is software', () => {
    const controls = sectionOf(generateServiceSurface(roverGraph()), 'replacement').controls;
    expect(controls.map(c => c.id)).not.toContain('replace.n7_app');
  });
});
