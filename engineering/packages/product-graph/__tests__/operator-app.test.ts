import { describe, it, expect } from 'vitest';
import { generateAppSchema, OperatorAppNode } from '../src/nodes/operator-app-node.js';
import { propagate } from '../src/propagation/propagation-engine.js';
import { bareContext, graphOf, motionStarterGraph, node } from './helpers.js';

describe('Gate 2 — operator app node world', () => {
  it('derives speed and direction controls from each motor', () => {
    const { graph } = propagate(motionStarterGraph());
    const app = generateAppSchema(graph, 'Rover');

    const speedControls = app.controls.filter(c => c.id.endsWith('.speed'));
    const directionControls = app.controls.filter(c => c.id.endsWith('.direction'));
    expect(speedControls).toHaveLength(2);
    expect(directionControls).toHaveLength(2);
    expect(speedControls[0].unit).toBe('rpm');
    expect(speedControls[0].max).toBe(200);
  });

  it('marks every control as bound by the firmware interlocks', () => {
    const { graph } = propagate(motionStarterGraph());
    const app = generateAppSchema(graph);
    expect(app.controls.length).toBeGreaterThan(0);
    for (const control of app.controls) {
      expect(control.firmwareInterlockRequired).toBe(true);
    }
  });

  it('adds battery telemetry and a low-charge alert', () => {
    const { graph } = propagate(motionStarterGraph());
    const app = generateAppSchema(graph);

    expect(app.telemetry.some(t => t.id === 'n1_battery.voltage')).toBe(true);
    expect(app.alerts.some(a => a.id === 'n1_battery.low-charge')).toBe(true);
  });

  it('carries the epistemic state of each telemetry source through to the app', () => {
    const { graph } = propagate(motionStarterGraph());
    const app = generateAppSchema(graph);
    const runtime = app.telemetry.find(t => t.id === 'n1_battery.runtime');
    // Runtime is derived from estimated loads, so the app must not present it
    // as anything stronger than an estimate.
    expect(runtime?.epistemicState).toBe('ESTIMATED');
  });

  it('adds a sensor telemetry channel with the right unit', () => {
    const { graph } = propagate(motionStarterGraph());
    const app = generateAppSchema(graph);
    const reading = app.telemetry.find(t => t.id === 'n5_sensor.reading');
    expect(reading?.unit).toBe('mm');
  });

  it('lists the transports the graph actually provides', () => {
    const { graph } = propagate(motionStarterGraph());
    const app = generateAppSchema(graph);
    expect(app.transport).toContain('bluetooth');
    expect(app.offlineCapable).toBe(true);
  });

  it('has no transport and is not offline-capable without a wireless path', () => {
    const graph = graphOf(
      [node('n1_battery', 'battery'), node('n2_motor', 'motor')],
      [],
    );
    const app = generateAppSchema(propagate(graph).graph);
    expect(app.transport).toHaveLength(0);
    expect(app.offlineCapable).toBe(false);
  });

  it('surfaces recorded node constraints as operator alerts', () => {
    const graph = graphOf(
      [{ ...node('n1_motor', 'motor'), constraints: ['motor.overvoltage'] }],
      [],
    );
    const app = generateAppSchema(graph);
    expect(app.alerts.some(a => a.message === 'motor.overvoltage' && a.severity === 'error'))
      .toBe(true);
  });

  it('produces the same app schema for the same graph every time', () => {
    const { graph } = propagate(motionStarterGraph());
    const first = JSON.stringify(generateAppSchema(graph));
    for (let i = 0; i < 5; i += 1) {
      expect(JSON.stringify(generateAppSchema(graph))).toBe(first);
    }
  });

  it('warns when no wireless link reaches the app', () => {
    const params = OperatorAppNode.parseParameters({});
    expect(OperatorAppNode.validate(params, bareContext()).map(c => c.code))
      .toContain('operator-app.no-transport');
  });

  it('is satisfied once a wireless capability is upstream', () => {
    const params = OperatorAppNode.parseParameters({});
    const ctx = bareContext({ upstream: { 'wireless.any': true } });
    expect(OperatorAppNode.validate(params, ctx)).toHaveLength(0);
  });
});
