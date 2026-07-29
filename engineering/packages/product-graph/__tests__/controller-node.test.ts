import { describe, it, expect } from 'vitest';
import { ControllerNode, CONTROLLER_PROFILES } from '../src/nodes/controller-node.js';
import { bareContext, node } from './helpers.js';

function metricsFor(raw: Record<string, unknown>) {
  return ControllerNode.deriveMetrics(ControllerNode.parseParameters(raw), bareContext());
}

describe('Gate 2 — controller node world', () => {
  it('exposes the frozen ESP32 profile', () => {
    const metrics = metricsFor({ controller: 'esp32' });
    expect(metrics.gpioCount).toBe(34);
    expect(metrics.ramKb).toBe(520);
    expect(metrics.hasWifi).toBe(true);
    expect(metrics.hasBle).toBe(true);
    expect(metrics.operatingVoltageV).toBe(3.3);
  });

  it('distinguishes the RP2040 from the ESP32', () => {
    const rp = metricsFor({ controller: 'rp2040' });
    expect(rp.hasWifi).toBe(false);
    expect(rp.hasBle).toBe(false);
    expect(rp.maxClockMhz).toBe(133);
  });

  it('labels its profile figures as estimates rather than measurements', () => {
    expect(metricsFor({ controller: 'esp32' }).epistemicState).toBe('ESTIMATED');
  });

  it('reduces available GPIO as pins are assigned', () => {
    const metrics = metricsFor({
      controller: 'esp32',
      assignedPins: { motorA: 'GPIO12', motorB: 'GPIO13' },
    });
    expect(metrics.usedGpio).toBe(2);
    expect(metrics.availableGpio).toBe(CONTROLLER_PROFILES.esp32.gpioCount - 2);
  });

  it('derives motor channels from the PWM budget', () => {
    expect(metricsFor({ controller: 'esp32' }).supportedMotorChannels).toBe(8);
    expect(metricsFor({ controller: 'rp2350' }).supportedMotorChannels).toBe(12);
  });

  it('advertises wireless capability from the profile', () => {
    const params = ControllerNode.parseParameters({ controller: 'esp32' });
    const caps = ControllerNode.exposeCapabilities(params, metricsFor({ controller: 'esp32' }));
    expect(caps['wireless.bluetooth']).toBe(true);
    expect(caps['wireless.any']).toBe(true);

    const rpParams = ControllerNode.parseParameters({ controller: 'rp2040' });
    const rpCaps = ControllerNode.exposeCapabilities(rpParams, metricsFor({ controller: 'rp2040' }));
    expect(rpCaps['wireless.any']).toBe(false);
  });

  it('demands a regulator when the supply exceeds the absolute maximum input', () => {
    const params = ControllerNode.parseParameters({ controller: 'esp32' });
    const ctx = bareContext({
      upstream: { 'power.voltageV': 11.1 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    expect(ControllerNode.validate(params, ctx).map(c => c.code))
      .toContain('controller.regulator-required');
  });

  it('accepts a board-input supply that would destroy the bare logic rail', () => {
    // 4.8 V is well past the 3.6 V chip limit but inside what a development
    // board's onboard regulator accepts.
    const params = ControllerNode.parseParameters({
      controller: 'esp32', supplyEntry: 'board-vin',
    });
    const ctx = bareContext({
      upstream: { 'power.voltageV': 4.8 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    expect(ControllerNode.validate(params, ctx)).toHaveLength(0);
  });

  it('still rejects a board-input supply above the regulator range', () => {
    const params = ControllerNode.parseParameters({
      controller: 'esp32', supplyEntry: 'board-vin',
    });
    const ctx = bareContext({
      upstream: { 'power.voltageV': 14.8 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    expect(ControllerNode.validate(params, ctx).map(c => c.code))
      .toContain('controller.regulator-required');
  });

  it('defaults to the logic rail, so an unstated supply entry stays strict', () => {
    const params = ControllerNode.parseParameters({ controller: 'esp32' });
    expect(params.supplyEntry).toBe('direct-3v3');
    const ctx = bareContext({
      upstream: { 'power.voltageV': 4.8 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    expect(ControllerNode.validate(params, ctx).map(c => c.code))
      .toContain('controller.regulator-required');
  });

  it('flags a supply below the operating voltage', () => {
    const params = ControllerNode.parseParameters({ controller: 'esp32' });
    const ctx = bareContext({
      upstream: { 'power.voltageV': 2.4 },
      upstreamNodes: [node('n_batt', 'battery')],
    });
    expect(ControllerNode.validate(params, ctx).map(c => c.code))
      .toContain('controller.undervoltage');
  });

  it('reports an unknown supply instead of assuming it is fine', () => {
    const params = ControllerNode.parseParameters({ controller: 'esp32' });
    const ctx = bareContext({ upstream: {}, upstreamNodes: [node('n_batt', 'battery')] });
    const results = ControllerNode.validate(params, ctx);
    expect(results.map(c => c.code)).toContain('controller.supply-unknown');
    expect(results.every(c => c.severity !== 'info')).toBe(true);
  });

  it('raises no supply constraint when nothing is connected yet', () => {
    const params = ControllerNode.parseParameters({ controller: 'esp32' });
    expect(ControllerNode.validate(params, bareContext())).toHaveLength(0);
  });

  it('detects two functions competing for the same pin', () => {
    const params = ControllerNode.parseParameters({
      controller: 'esp32',
      assignedPins: { motorA: 'GPIO12', motorB: 'GPIO12' },
    });
    expect(ControllerNode.validate(params, bareContext()).map(c => c.code))
      .toContain('controller.pin-conflict');
  });

  it('publishes its own draw as an upstream power requirement', () => {
    const params = ControllerNode.parseParameters({ controller: 'esp32' });
    const requirements = ControllerNode.exposeRequirements(params, metricsFor({ controller: 'esp32' }));
    expect(requirements['power.voltageV']).toBe(3.3);
    expect(requirements['power.currentA']).toBe(0.16);
    expect(requirements['power.loadW']).toBeCloseTo(0.528, 4);
  });
});
