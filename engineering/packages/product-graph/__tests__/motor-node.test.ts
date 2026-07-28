import { describe, it, expect } from 'vitest';
import { MotorNode } from '../src/nodes/motor-node.js';
import { bareContext, connection, graphOf, node } from './helpers.js';

function metricsFor(raw: Record<string, unknown> = {}) {
  return MotorNode.deriveMetrics(MotorNode.parseParameters(raw), bareContext());
}

describe('Gate 2 — motor node world', () => {
  it('divides RPM by the gear ratio', () => {
    expect(metricsFor({ noLoadRpm: 300, gearRatio: 3 }).effectiveRpm).toBe(100);
  });

  it('multiplies torque by the gear ratio, less gearbox losses', () => {
    // 8 Ncm x 3 x 0.85 transmission efficiency
    expect(metricsFor({ stallTorqueNcm: 8, gearRatio: 3 }).effectiveTorqueNcm).toBe(20.4);
  });

  it('treats direct drive as lossless', () => {
    const metrics = metricsFor({ stallTorqueNcm: 8, gearRatio: 1 });
    expect(metrics.gearboxEfficiency).toBe(1);
    expect(metrics.effectiveTorqueNcm).toBe(8);
  });

  it('derives ground speed from wheel circumference and shaft RPM', () => {
    // pi x 65 mm x 200 rpm / 60000 = 0.6807 m/s
    expect(metricsFor({ noLoadRpm: 200, wheelDiameterMm: 65, gearRatio: 1 }).speedMps)
      .toBeCloseTo(0.6807, 4);
  });

  it('slows the wheel when the gearbox is geared down', () => {
    const direct = metricsFor({ noLoadRpm: 200, gearRatio: 1 }).speedMps as number;
    const geared = metricsFor({ noLoadRpm: 200, gearRatio: 4 }).speedMps as number;
    expect(geared).toBeLessThan(direct);
  });

  it('computes running power from rated voltage and typical current', () => {
    const metrics = metricsFor({ ratedVoltageV: 6, stallCurrentA: 1.5 });
    expect(metrics.typicalCurrentA).toBe(0.6);
    expect(metrics.powerConsumptionW).toBe(3.6);
    expect(metrics.stallPowerW).toBe(9);
  });

  it('picks the driver stage each motor type needs', () => {
    expect(metricsFor({ motorType: 'dc-brushed' }).driverRequirement).toBe('h-bridge');
    expect(metricsFor({ motorType: 'servo' }).driverRequirement).toBe('direct');
    expect(metricsFor({ motorType: 'stepper' }).driverRequirement).toBe('stepper-driver');
  });

  it('labels its output figures as estimates', () => {
    expect(metricsFor().epistemicState).toBe('ESTIMATED');
  });

  it('flags a supply more than 20% above the motor rating', () => {
    const params = MotorNode.parseParameters({ ratedVoltageV: 6 });
    const ctx = bareContext({
      upstream: { 'power.voltageV': 11.1 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    expect(MotorNode.validate(params, ctx).map(c => c.code)).toContain('motor.overvoltage');
  });

  it('accepts a supply sitting exactly on the 20% tolerance limit', () => {
    // 3 x 1.2 is 3.5999999999999996 in binary floating point; a 3.6 V pack on
    // a 3 V motor must still read as in-tolerance.
    const params = MotorNode.parseParameters({ ratedVoltageV: 3 });
    const ctx = bareContext({
      upstream: { 'power.voltageV': 3.6 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    expect(MotorNode.validate(params, ctx).map(c => c.code)).not.toContain('motor.overvoltage');
  });

  it('warns when the supply sits well below the rating', () => {
    const params = MotorNode.parseParameters({ ratedVoltageV: 6 });
    const ctx = bareContext({
      upstream: { 'power.voltageV': 3.6 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    const undervoltage = MotorNode.validate(params, ctx).find(c => c.code === 'motor.undervoltage');
    expect(undervoltage?.severity).toBe('warning');
  });

  it('flags a stall current the pack cannot deliver', () => {
    const params = MotorNode.parseParameters({ ratedVoltageV: 6, stallCurrentA: 2.5 });
    const ctx = bareContext({
      upstream: { 'power.voltageV': 6, 'power.maxCurrentA': 1 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    expect(MotorNode.validate(params, ctx).map(c => c.code))
      .toContain('motor.stall-current-exceeds-supply');
  });

  it('warns when a brushed motor has no control stage driving it', () => {
    const params = MotorNode.parseParameters({ motorType: 'dc-brushed' });
    expect(MotorNode.validate(params, bareContext({ nodeId: 'n_motor' })).map(c => c.code))
      .toContain('motor.no-driver');
  });

  it('accepts a brushed motor once a control edge reaches it', () => {
    const params = MotorNode.parseParameters({ motorType: 'dc-brushed' });
    const graph = graphOf(
      [node('n_ctrl', 'controller'), node('n_motor', 'motor')],
      [connection('c1', 'n_ctrl', 'n_motor', 'control')],
    );
    const ctx = bareContext({ nodeId: 'n_motor', graph });
    expect(MotorNode.validate(params, ctx).map(c => c.code)).not.toContain('motor.no-driver');
  });

  it('exposes one motion unit per node', () => {
    const params = MotorNode.parseParameters({});
    const caps = MotorNode.exposeCapabilities(params, metricsFor());
    expect(caps['motor.count']).toBe(1);
    expect(caps['motion.present']).toBe(true);
  });
});
