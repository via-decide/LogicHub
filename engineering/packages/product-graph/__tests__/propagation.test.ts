import { describe, it, expect } from 'vitest';
import { propagate, topologicalOrder } from '../src/propagation/propagation-engine.js';
import {
  connection,
  findNode,
  graphOf,
  motionStarterGraph,
  node,
} from './helpers.js';

describe('Gate 2 — consequence propagation', () => {
  it('orders a chain so every producer resolves before its consumer', () => {
    const graph = graphOf(
      [node('n3', 'motor'), node('n1', 'battery'), node('n2', 'controller')],
      [connection('c1', 'n1', 'n2', 'power'), connection('c2', 'n2', 'n3', 'control')],
    );
    expect(topologicalOrder(graph).order).toEqual(['n1', 'n2', 'n3']);
  });

  it('reports a dependency cycle instead of looping forever', () => {
    const graph = graphOf(
      [node('n1', 'battery'), node('n2', 'controller')],
      [connection('c1', 'n1', 'n2', 'power'), connection('c2', 'n2', 'n1', 'data')],
    );
    const result = propagate(graph);
    expect(result.cycleNodeIds.sort()).toEqual(['n1', 'n2']);
    expect(result.violations.map(v => v.code)).toContain('graph.dependency-cycle');
  });

  it('fills in derived metrics across the whole Motion Starter slice', () => {
    const { graph } = propagate(motionStarterGraph());

    expect(findNode(graph, 'n1_battery').derivedMetrics.nominalVoltageV).toBe(3.6);
    expect(findNode(graph, 'n2_controller').derivedMetrics.availableGpio).toBe(30);
    // Nameplate 200 rpm at 3 V, scaled by the 3.6 V the pack actually supplies.
    expect(findNode(graph, 'n3_motor_left').derivedMetrics.effectiveRpm).toBe(240);
    expect(findNode(graph, 'n7_app').derivedMetrics.controlCount).toBe(5);
  });

  it('leaves the Motion Starter slice free of supply-compatibility errors', () => {
    const { violations } = propagate(motionStarterGraph());
    const errors = violations.filter(v => v.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('resolves battery runtime from the loads it actually carries', () => {
    const { graph } = propagate(motionStarterGraph());
    const battery = findNode(graph, 'n1_battery');

    expect(battery.derivedMetrics.runtimeKnown).toBe(true);
    // 3.6 V x 2000 mAh = 7.2 Wh against the summed downstream draw.
    expect(battery.derivedMetrics.storedEnergyWh).toBe(7.2);
    expect(battery.derivedMetrics.estimatedRuntimeH as number).toBeGreaterThan(1);
    expect(battery.derivedMetrics.estimatedRuntimeH as number).toBeLessThan(2);
  });

  it('cascades a battery change through controller and motors', () => {
    const base = motionStarterGraph();
    const upgraded = {
      ...base,
      nodes: base.nodes.map(n =>
        n.id === 'n1_battery'
          ? { ...n, parameters: { ...n.parameters, chemistry: 'lipo', cellCount: 4 } }
          : n,
      ),
    };

    const before = propagate(base);
    const after = propagate(upgraded);

    expect(findNode(before.graph, 'n1_battery').derivedMetrics.nominalVoltageV).toBe(3.6);
    expect(findNode(after.graph, 'n1_battery').derivedMetrics.nominalVoltageV).toBe(14.8);

    // 14.8 V is far past what the ESP32 tolerates and what a 3 V motor wants.
    const codes = after.violations.map(v => v.code);
    expect(codes).toContain('controller.regulator-required');
    expect(codes).toContain('motor.overvoltage');

    expect(before.violations.map(v => v.code)).not.toContain('controller.regulator-required');
  });

  it('records constraint codes on the node that raised them', () => {
    const base = motionStarterGraph();
    const upgraded = {
      ...base,
      nodes: base.nodes.map(n =>
        n.id === 'n1_battery'
          ? { ...n, parameters: { ...n.parameters, chemistry: 'lipo', cellCount: 4 } }
          : n,
      ),
    };
    const { graph } = propagate(upgraded);
    expect(findNode(graph, 'n2_controller').constraints).toContain('controller.regulator-required');
  });

  it('does not disturb a node that shares no edge with the change', () => {
    const base = motionStarterGraph();
    const isolated = {
      ...base,
      nodes: [...base.nodes, node('n9_spare', 'motor', { ratedVoltageV: 6, noLoadRpm: 120 })],
    };

    const first = propagate(isolated).graph;
    const changed = {
      ...isolated,
      nodes: isolated.nodes.map(n =>
        n.id === 'n1_battery' ? { ...n, parameters: { ...n.parameters, capacityMah: 3000 } } : n,
      ),
    };
    const second = propagate(changed).graph;

    expect(findNode(second, 'n9_spare').derivedMetrics)
      .toEqual(findNode(first, 'n9_spare').derivedMetrics);
  });

  it('flags a power budget the pack cannot meet', () => {
    const graph = graphOf(
      [
        node('n1', 'battery', { chemistry: 'nimh', cellCount: 3, capacityMah: 500, dischargeRating: 1 }),
        node('n2', 'motor', { ratedVoltageV: 3, stallCurrentA: 1.5 }),
      ],
      [connection('c1', 'n1', 'n2', 'power')],
    );
    expect(propagate(graph).violations.map(v => v.code)).toContain('power.budget-exceeded');
  });

  it('says the power budget is incomplete rather than passing it', () => {
    const graph = graphOf(
      [node('n1', 'battery'), node('n2', 'connectivity')],
      [connection('c1', 'n1', 'n2', 'power')],
    );
    const codes = propagate(graph).violations.map(v => v.code);
    expect(codes).toContain('power.budget-unknown');
    expect(codes).not.toContain('power.budget-exceeded');
  });

  it('reports an unreadable node instead of carrying stale values forward', () => {
    const graph = graphOf([node('n1', 'battery', { cellCount: 99 })], []);
    const result = propagate(graph);

    expect(result.violations.map(v => v.code)).toContain('node.invalid-parameters');
    expect(findNode(result.graph, 'n1').derivedMetrics).toEqual({});
    expect(findNode(result.graph, 'n1').capabilities).toEqual({});
  });

  it('reports a node type it has no plugin for', () => {
    const graph = {
      ...graphOf([], []),
      nodes: [{ ...node('n1', 'battery'), type: 'flux-capacitor' }],
    };
    expect(propagate(graph).violations.map(v => v.code)).toContain('graph.unknown-node-type');
  });

  it('is deterministic: ten runs produce byte-identical output', () => {
    const graph = motionStarterGraph();
    const baseline = JSON.stringify(propagate(graph));
    for (let i = 0; i < 10; i += 1) {
      expect(JSON.stringify(propagate(graph))).toBe(baseline);
    }
  });

  it('treats recalculation as a read, leaving updatedAt alone', () => {
    const graph = motionStarterGraph();
    expect(propagate(graph).graph.updatedAt).toBe(graph.updatedAt);
  });

  it('enforces beginner bounds when the graph is in explore mode', () => {
    const base = motionStarterGraph('explore');
    const hot = {
      ...base,
      nodes: base.nodes.map(n =>
        n.id === 'n1_battery'
          ? { ...n, parameters: { chemistry: 'liion', cellCount: 6, capacityMah: 2200, dischargeRating: 25 } }
          : n,
      ),
    };
    const codes = propagate(hot).violations.map(v => v.code);
    expect(codes).toContain('battery.explore-cell-count');
    expect(codes).toContain('battery.explore-chemistry');
  });
});
