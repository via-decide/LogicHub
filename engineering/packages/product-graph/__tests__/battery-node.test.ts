import { describe, it, expect } from 'vitest';
import { BatteryNode, MAX_RELEASE_PEAK_CURRENT_A } from '../src/nodes/battery-node.js';
import { bareContext, node } from './helpers.js';

function metricsFor(raw: Record<string, unknown>, ctx = bareContext()) {
  const params = BatteryNode.parseParameters(raw);
  return BatteryNode.deriveMetrics(params, ctx);
}

describe('Gate 2 — battery node world', () => {
  it('derives 11.1 V from a 3S LiPo pack', () => {
    const metrics = metricsFor({ chemistry: 'lipo', cellCount: 3 });
    expect(metrics.nominalVoltageV).toBe(11.1);
  });

  it('derives 14.8 V from a 4S LiPo pack', () => {
    const metrics = metricsFor({ chemistry: 'lipo', cellCount: 4 });
    expect(metrics.nominalVoltageV).toBe(14.8);
  });

  it('uses 1.2 V per cell for NiMH', () => {
    const metrics = metricsFor({ chemistry: 'nimh', cellCount: 4 });
    expect(metrics.cellVoltageV).toBe(1.2);
    expect(metrics.nominalVoltageV).toBe(4.8);
  });

  it('uses 1.5 V per cell for alkaline', () => {
    expect(metricsFor({ chemistry: 'alkaline', cellCount: 4 }).nominalVoltageV).toBe(6);
  });

  it('computes stored energy from voltage and capacity', () => {
    const metrics = metricsFor({ chemistry: 'lipo', cellCount: 3, capacityMah: 2200 });
    expect(metrics.storedEnergyWh).toBe(24.42);
  });

  it('computes peak current from capacity and discharge rating', () => {
    const metrics = metricsFor({ capacityMah: 2200, dischargeRating: 25 });
    expect(metrics.peakCurrentA).toBe(55);
  });

  it('leaves runtime unknown when nothing downstream publishes a load', () => {
    const metrics = metricsFor({ chemistry: 'nimh', cellCount: 3, capacityMah: 2000 });
    expect(metrics.runtimeKnown).toBe(false);
    expect(metrics.estimatedRuntimeH).toBeUndefined();
    expect(metrics.totalLoadW).toBeUndefined();
  });

  it('computes runtime once downstream loads are known', () => {
    const load = { ...node('n_load', 'motor'), requirements: { 'power.loadW': 1.8 } };
    const ctx = bareContext({ transitiveDownstreamNodes: [load, load] });
    const metrics = metricsFor({ chemistry: 'nimh', cellCount: 3, capacityMah: 2000 }, ctx);

    expect(metrics.runtimeKnown).toBe(true);
    expect(metrics.totalLoadW).toBe(3.6);
    expect(metrics.estimatedRuntimeH).toBe(2);
    // Runtime rests on estimated downstream draw and is labelled as such.
    expect(metrics.runtimeEpistemicState).toBe('ESTIMATED');
  });

  it('publishes runtime as a capability only when it is actually known', () => {
    const params = BatteryNode.parseParameters({});
    const unknown = BatteryNode.exposeCapabilities(params, metricsFor({}));
    expect(unknown['battery.runtimeH']).toBeUndefined();
    expect(unknown['power.available']).toBe(true);

    const load = { ...node('n_load', 'motor'), requirements: { 'power.loadW': 2 } };
    const ctx = bareContext({ transitiveDownstreamNodes: [load] });
    const known = BatteryNode.exposeCapabilities(params, metricsFor({}, ctx));
    expect(known['battery.runtimeH']).toBeDefined();
  });

  it('blocks high-current packs in every mode for this release', () => {
    const params = BatteryNode.parseParameters({ capacityMah: 5000, dischargeRating: 25 });
    const codes = BatteryNode
      .validate(params, bareContext({ userMode: 'engineer' }))
      .map(c => c.code);
    expect(codes).toContain('battery.high-current-not-enabled');
    expect((5000 * 25) / 1000).toBeGreaterThan(MAX_RELEASE_PEAK_CURRENT_A);
  });

  it('rejects more than four cells in explore mode', () => {
    const params = BatteryNode.parseParameters({ cellCount: 5 });
    const explore = BatteryNode.validate(params, bareContext({ userMode: 'explore' }));
    expect(explore.map(c => c.code)).toContain('battery.explore-cell-count');

    const builder = BatteryNode.validate(params, bareContext({ userMode: 'builder' }));
    expect(builder.map(c => c.code)).not.toContain('battery.explore-cell-count');
  });

  it('rejects li-ion chemistry and high peak current in explore mode', () => {
    const params = BatteryNode.parseParameters({
      chemistry: 'liion', cellCount: 3, capacityMah: 2200, dischargeRating: 25,
    });
    const codes = BatteryNode
      .validate(params, bareContext({ userMode: 'explore' }))
      .map(c => c.code);
    expect(codes).toContain('battery.explore-chemistry');
    expect(codes).toContain('battery.explore-peak-current');
  });

  it('ships defaults that satisfy its own explore-mode bounds', () => {
    // A beginner's first battery must not be invalid the moment it appears.
    const defaults = BatteryNode.defaultParameters;
    const results = BatteryNode.validate(defaults, bareContext({ userMode: 'explore' }));
    expect(results).toEqual([]);
  });

  it('publishes explore-mode bounds that match what validation enforces', () => {
    const bounds = BatteryNode.getSafeParameterBounds();
    const cellBound = bounds.find(b => b.parameter === 'cellCount');
    expect(cellBound?.max).toBe(4);
    const chemistryBound = bounds.find(b => b.parameter === 'chemistry');
    expect(chemistryBound?.allowedValues).not.toContain('liion');
  });
});
