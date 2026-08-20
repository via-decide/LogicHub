import { describe, it, expect } from 'vitest';
import { DriverNode } from '../src/nodes/driver-node.js';
import { propagate } from '../src/propagation/propagation-engine.js';
import { bareContext, connection, graphOf, findNode, node } from './helpers.js';

function motorNode(id: string, stallCurrentA = 1.5) {
  return node(id, 'motor', {
    motorType: 'dc-brushed', ratedVoltageV: 6, stallCurrentA,
  });
}

/** A motor that has already resolved, as it would be on the second pass. */
function resolvedMotor(id: string, typicalCurrentA: number) {
  const motor = motorNode(id);
  return { ...motor, derivedMetrics: { typicalCurrentA } };
}

describe('driver node — the stage that turns motor current into heat', () => {
  it('has no dissipation figure when nothing is connected below it', () => {
    const metrics = DriverNode.deriveMetrics(DriverNode.parseParameters({}), bareContext());

    // The point of the whole file: absent, not zero. Zero watts would read as a
    // part that runs cold rather than one nobody worked out.
    expect(metrics.dissipationW).toBeUndefined();
    expect(metrics.conductionDissipationW).toBeUndefined();
    expect(metrics.currentBasis).toBe('none');
    expect(metrics.channelsInUse).toBe(0);
  });

  it('has no dissipation figure while the motors below it are still unresolved', () => {
    const ctx = bareContext({ downstreamNodes: [motorNode('n_m1')] });
    const metrics = DriverNode.deriveMetrics(DriverNode.parseParameters({}), ctx);

    expect(metrics.currentBasis).toBe('pending');
    expect(metrics.dissipationW).toBeUndefined();
  });

  it('computes conduction loss from the current the motors actually draw', () => {
    // 0.6 A through two devices of 0.5 ohm each: 0.6^2 * 0.5 * 2 = 0.36 W per
    // channel, two channels in use.
    const ctx = bareContext({
      downstreamNodes: [resolvedMotor('n_m1', 0.6), resolvedMotor('n_m2', 0.6)],
    });
    const params = DriverNode.parseParameters({ rdsOnMilliohm: 500, channels: 2 });
    const metrics = DriverNode.deriveMetrics(params, ctx);

    expect(metrics.currentBasis).toBe('downstream');
    expect(metrics.channelsInUse).toBe(2);
    expect(metrics.conductionDissipationW).toBe(0.72);
    // Plus 2 mA of quiescent draw at 3.3 V.
    expect(metrics.quiescentDissipationW).toBe(0.0066);
    expect(metrics.dissipationW).toBe(0.7266);
  });

  it('sizes on the heaviest motor, since channels are independent', () => {
    const ctx = bareContext({
      downstreamNodes: [resolvedMotor('n_m1', 0.2), resolvedMotor('n_m2', 0.8)],
    });
    const metrics = DriverNode.deriveMetrics(DriverNode.parseParameters({}), ctx);

    expect(metrics.drivenCurrentA).toBe(0.8);
  });

  it('counts one conducting device for a low-side switch, two for a bridge', () => {
    const ctx = bareContext({ downstreamNodes: [resolvedMotor('n_m1', 1)] });

    const bridge = DriverNode.deriveMetrics(
      DriverNode.parseParameters({ driverFamily: 'h-bridge', rdsOnMilliohm: 1000 }), ctx);
    const lowSide = DriverNode.deriveMetrics(
      DriverNode.parseParameters({ driverFamily: 'low-side-switch', rdsOnMilliohm: 1000 }), ctx);

    // 1 A through 1 ohm: 2 W through a bridge, 1 W through a single device.
    expect(bridge.conductionDissipationW).toBe(2);
    expect(lowSide.conductionDissipationW).toBe(1);
  });

  it('publishes no dissipation capability when there is none to publish', () => {
    const params = DriverNode.parseParameters({});
    const metrics = DriverNode.deriveMetrics(params, bareContext());
    const capabilities = DriverNode.exposeCapabilities(params, metrics);

    expect(capabilities['driver.present']).toBe(true);
    expect('driver.dissipationW' in capabilities).toBe(false);
  });

  it('publishes only its incremental current draw to the power budget', () => {
    const params = DriverNode.parseParameters({ quiescentCurrentMa: 2 });
    const metrics = DriverNode.deriveMetrics(params, bareContext({
      downstreamNodes: [resolvedMotor('n_m1', 3)],
    }));

    expect(DriverNode.exposeRequirements(params, metrics)['power.currentA']).toBe(0.002);
  });

  it('publishes a thermal resistance only when one was declared', () => {
    const without = DriverNode.parseParameters({});
    const withTheta = DriverNode.parseParameters({
      thermalResistanceKPerW: 40, thermalResistanceClass: 'datasheet',
    });

    const a = DriverNode.exposeCapabilities(
      without, DriverNode.deriveMetrics(without, bareContext()));
    const b = DriverNode.exposeCapabilities(
      withTheta, DriverNode.deriveMetrics(withTheta, bareContext()));

    expect('driver.thermalResistanceKPerW' in a).toBe(false);
    expect(b['driver.thermalResistanceKPerW']).toBe(40);
    expect(b['driver.thermalResistanceClass']).toBe('datasheet');
  });

  it('defaults its thermal resistance class to unknown, never to estimated', () => {
    // An estimate is a claim about the package. Nobody made one.
    expect(DriverNode.parseParameters({}).thermalResistanceClass).toBe('unknown');
    expect(DriverNode.parseParameters({}).thermalResistanceKPerW).toBeUndefined();
  });

  it('says plainly that an undeclared thermal resistance is not a pass', () => {
    const results = DriverNode.validate(DriverNode.parseParameters({}), bareContext());
    const finding = results.find(r => r.code === 'driver.thermal-resistance-unknown');

    expect(finding?.severity).toBe('info');
    expect(finding?.message).toContain('not a pass');
  });

  it('refuses a supply above the window the part declares', () => {
    const ctx = bareContext({
      upstream: { 'power.voltageV': 14.4 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    const results = DriverNode.validate(DriverNode.parseParameters({}), ctx);

    expect(results.map(r => r.code)).toContain('driver.overvoltage');
    expect(results.find(r => r.code === 'driver.overvoltage')?.severity).toBe('error');
  });

  it('refuses a supply below the voltage it needs to switch', () => {
    const ctx = bareContext({
      upstream: { 'power.voltageV': 1.8 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    const results = DriverNode.validate(DriverNode.parseParameters({}), ctx);

    expect(results.map(r => r.code)).toContain('driver.undervoltage');
  });

  it('warns rather than passing when the supply is unknown', () => {
    const ctx = bareContext({ upstreamNodes: [node('n_batt', 'battery')] });
    const results = DriverNode.validate(DriverNode.parseParameters({}), ctx);

    expect(results.map(r => r.code)).toContain('driver.supply-unknown');
  });

  it('refuses more motors than it has channels', () => {
    const ctx = bareContext({
      downstreamNodes: [
        resolvedMotor('n_m1', 0.5), resolvedMotor('n_m2', 0.5), resolvedMotor('n_m3', 0.5),
      ],
    });
    const results = DriverNode.validate(DriverNode.parseParameters({ channels: 2 }), ctx);

    const finding = results.find(r => r.code === 'driver.channels-exceeded');
    expect(finding?.severity).toBe('error');
    expect(finding?.message).toContain('3 motors');
  });

  it('refuses a motor current above its continuous rating', () => {
    const ctx = bareContext({ downstreamNodes: [resolvedMotor('n_m1', 2)] });
    const results = DriverNode.validate(
      DriverNode.parseParameters({ maxContinuousCurrentA: 1.2 }), ctx);

    expect(results.map(r => r.code)).toContain('driver.current-exceeded');
  });

  it('refuses a supply window whose minimum is above its maximum', () => {
    const results = DriverNode.validate(
      DriverNode.parseParameters({ supplyVoltageMinV: 12, supplyVoltageMaxV: 5 }),
      bareContext(),
    );

    expect(results.map(r => r.code)).toContain('driver.supply-window-inverted');
  });

  it('resolves its loss through the propagation engine, not just in isolation', () => {
    const graph = graphOf(
      [
        node('n1_battery', 'battery', { chemistry: 'nimh', cellCount: 4, dischargeRating: 5 }),
        node('n2_driver', 'driver', { rdsOnMilliohm: 500, channels: 2 }),
        node('n3_motor', 'motor', {
          motorType: 'dc-brushed', ratedVoltageV: 6, stallCurrentA: 1.5,
        }),
      ],
      [
        connection('c1', 'n1_battery', 'n2_driver', 'power'),
        connection('c2', 'n2_driver', 'n3_motor', 'power'),
      ],
    );

    const resolved = propagate(graph).graph;
    const driver = findNode(resolved, 'n2_driver');

    // The second pass is what makes this work: the driver cannot know its
    // current until the motor below it has published one.
    expect(driver.derivedMetrics.currentBasis).toBe('downstream');
    // 1.5 A stall at the 0.4 typical-load fraction is 0.6 A.
    expect(driver.derivedMetrics.drivenCurrentA).toBe(0.6);
    expect(driver.derivedMetrics.dissipationW).toBe(0.3666);
  });

  it('answers the motor node’s complaint that no driver stage exists', () => {
    const graph = graphOf(
      [
        node('n1_controller', 'controller', {}),
        node('n2_driver', 'driver', {}),
        node('n3_motor', 'motor', { motorType: 'dc-brushed' }),
      ],
      [
        connection('c1', 'n1_controller', 'n2_driver', 'control'),
        connection('c2', 'n2_driver', 'n3_motor', 'control'),
      ],
    );

    const resolved = propagate(graph).graph;
    const motor = findNode(resolved, 'n3_motor');

    expect(motor.constraints).not.toContain('motor.no-driver');
  });

  it('is deterministic', () => {
    const params = DriverNode.parseParameters({});
    const ctx = bareContext({ downstreamNodes: [resolvedMotor('n_m1', 0.6)] });

    expect(DriverNode.deriveMetrics(params, ctx))
      .toEqual(DriverNode.deriveMetrics(params, ctx));
  });

  it('bounds its parameters in explore mode', () => {
    const bounded = DriverNode.getSafeParameterBounds().map(b => b.parameter);

    expect(bounded).toContain('channels');
    expect(bounded).toContain('maxContinuousCurrentA');
  });
});
