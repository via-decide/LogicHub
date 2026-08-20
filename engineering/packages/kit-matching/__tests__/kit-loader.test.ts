import { describe, it, expect } from 'vitest';
import {
  ProductGraphSchema,
  propagate,
  matchProducts,
  addNode,
  updateNodeParameters,
  removeNode,
} from '@logichub-engineering/product-graph';
import { kitToGraph } from '../src/loader/kit-to-graph.js';
import { REFERENCE_KITS, requireKit } from '../src/kits/index.js';

const FIXED_TIME = '2026-01-01T00:00:00.000Z';

function loadMotionStarter() {
  return kitToGraph(requireKit('motion-starter'), { now: FIXED_TIME });
}

describe('Gate 4 — a kit loads as an editable graph', () => {
  it('produces a schema-valid graph for every reference kit', () => {
    for (const kit of REFERENCE_KITS) {
      const graph = kitToGraph(kit, { now: FIXED_TIME });
      const result = ProductGraphSchema.safeParse(graph);
      expect(result.success, `${kit.id} produced an invalid graph`).toBe(true);
    }
  });

  it('creates one node per unit of each component that has a node type', () => {
    const graph = loadMotionStarter();
    // Two motors, one controller, one battery, one sensor, one link, one app.
    expect(graph.nodes.filter(n => n.type === 'motor')).toHaveLength(2);
    expect(graph.nodes.filter(n => n.type === 'controller')).toHaveLength(1);
    expect(graph.nodes.filter(n => n.type === 'battery')).toHaveLength(1);
    expect(graph.nodes.filter(n => n.type === 'sensor')).toHaveLength(1);
    expect(graph.nodes.filter(n => n.type === 'connectivity')).toHaveLength(1);
    expect(graph.nodes.filter(n => n.type === 'operator-app')).toHaveLength(1);
    // The kit has listed a TB6612 since Gate 4 with nowhere to put it. Now that
    // a driver node type exists, it becomes part of the graph rather than a
    // line on a bill of materials.
    expect(graph.nodes.filter(n => n.type === 'driver')).toHaveLength(1);
  });

  it('leaves parts with no node type out of the graph', () => {
    const graph = loadMotionStarter();
    const sources = graph.nodes.map(n => n.parameters.sourceComponentId);
    expect(sources).not.toContain('mechanical-chassis-2wd');
    expect(sources).not.toContain('wiring-jumper-set');
  });

  it('records the component each node came from', () => {
    const graph = loadMotionStarter();
    for (const node of graph.nodes) {
      if (node.type === 'operator-app') continue;
      expect(typeof node.parameters.sourceComponentId).toBe('string');
    }
  });

  it('wires power from the pack and control from the controller', () => {
    const graph = loadMotionStarter();
    const battery = graph.nodes.find(n => n.type === 'battery')!;
    const controller = graph.nodes.find(n => n.type === 'controller')!;

    const driver = graph.nodes.find(n => n.type === 'driver')!;
    const motors = graph.nodes.filter(n => n.type === 'motor');

    // The pack feeds the controller, driver, sensor and link, but not motors
    // that have an instantiated power stage.
    const powered = graph.connections.filter(c => c.from === battery.id && c.type === 'power');
    expect(powered).toHaveLength(4);
    expect(powered.map(c => c.to)).not.toEqual(expect.arrayContaining(motors.map(m => m.id)));

    const controlled = graph.connections.filter(
      c => c.from === controller.id && c.type === 'control',
    );
    expect(controlled.map(c => c.to)).toEqual([driver.id]);
    expect(graph.connections.filter(c => c.from === driver.id && c.type === 'power'))
      .toHaveLength(2);
    expect(graph.connections.filter(c => c.from === driver.id && c.type === 'control'))
      .toHaveLength(2);
  });

  it('does not run power to the operator app', () => {
    const graph = loadMotionStarter();
    const app = graph.nodes.find(n => n.type === 'operator-app')!;
    expect(graph.connections.some(c => c.to === app.id && c.type === 'power')).toBe(false);
  });

  it('builds the same graph structure from the same kit every time', () => {
    const first = kitToGraph(requireKit('motion-starter'), { now: FIXED_TIME });
    const second = kitToGraph(requireKit('motion-starter'), { now: FIXED_TIME });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('resolves the loaded Motion Starter with no supply errors', () => {
    const { graph, violations } = propagate(loadMotionStarter());
    const errors = violations.filter(v => v.severity === 'error');
    expect(errors).toEqual([]);
    expect(graph.nodes.find(n => n.type === 'driver')?.derivedMetrics.currentBasis)
      .toBe('downstream');
  });

  it('feeds the controller through its board input rather than the logic rail', () => {
    const { graph } = propagate(loadMotionStarter());
    const controller = graph.nodes.find(n => n.type === 'controller')!;
    // A 4-cell NiMH pack sits at 4.8 V, above the 3.6 V chip limit but inside
    // the range a development board's onboard regulator accepts.
    expect(controller.derivedMetrics.supplyEntry).toBe('board-vin');
    expect(controller.constraints).not.toContain('controller.regulator-required');
  });

  it('reaches CAN_MAKE for the bluetooth rover straight from the kit', () => {
    const { graph } = propagate(loadMotionStarter());
    const rover = matchProducts(graph).find(r => r.templateId === 'bluetooth-rover')!;
    expect(rover.verdict).toBe('CAN_MAKE');
  });

  it('resolves every other reference kit without supply errors', () => {
    for (const kit of REFERENCE_KITS) {
      const { violations } = propagate(kitToGraph(kit, { now: FIXED_TIME }));
      const errors = violations.filter(v => v.severity === 'error');
      expect(errors, `${kit.id} produced ${errors.map(e => e.code).join(', ')}`).toEqual([]);
    }
  });

  it('stays editable: a node can be added after loading', () => {
    const graph = addNode(loadMotionStarter(), 'sensor', { x: 400, y: 300 });
    expect(graph.nodes.filter(n => n.type === 'sensor')).toHaveLength(2);
    expect(propagate(graph).graph.nodes).toHaveLength(graph.nodes.length);
  });

  it('stays editable: swapping the controller recalculates the graph', () => {
    const graph = loadMotionStarter();
    const controller = graph.nodes.find(n => n.type === 'controller')!;

    const before = propagate(graph).graph;
    const swapped = updateNodeParameters(graph, controller.id, { controller: 'rp2350' });
    const after = propagate(swapped).graph;

    const beforeNode = before.nodes.find(n => n.id === controller.id)!;
    const afterNode = after.nodes.find(n => n.id === controller.id)!;

    expect(beforeNode.derivedMetrics.model).toBe('esp32');
    expect(afterNode.derivedMetrics.model).toBe('rp2350');
    // The RP2350 has no onboard radio, so the controller stops advertising one.
    expect(beforeNode.capabilities['wireless.bluetooth']).toBe(true);
    expect(afterNode.capabilities['wireless.bluetooth']).toBe(false);
  });

  it('stays editable: increasing pack capacity extends estimated runtime', () => {
    const graph = loadMotionStarter();
    const battery = graph.nodes.find(n => n.type === 'battery')!;

    const before = propagate(graph).graph.nodes.find(n => n.id === battery.id)!;
    const bigger = updateNodeParameters(graph, battery.id, { capacityMah: 4000 });
    const after = propagate(bigger).graph.nodes.find(n => n.id === battery.id)!;

    expect(after.derivedMetrics.estimatedRuntimeH as number)
      .toBeGreaterThan(before.derivedMetrics.estimatedRuntimeH as number);
  });

  it('stays editable: removing the link drops mobile control', () => {
    const graph = loadMotionStarter();
    const link = graph.nodes.find(n => n.type === 'connectivity')!;
    const reduced = removeNode(graph, link.id);

    expect(reduced.nodes.filter(n => n.type === 'connectivity')).toHaveLength(0);
    expect(reduced.connections.some(c => c.from === link.id || c.to === link.id)).toBe(false);
  });
});
