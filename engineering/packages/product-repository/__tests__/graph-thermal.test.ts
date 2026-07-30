import { describe, it, expect } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';
import type { OperatingProfile } from '@logichub-engineering/contracts';
import { propagate, type ProductGraph } from '@logichub-engineering/product-graph';
import { assessThermal } from '../src/thermal/graph-thermal.js';

const FIXED_TIME = '2026-01-01T00:00:00.000Z';

function profile(overrides: Partial<OperatingProfile> = {}): OperatingProfile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ambientTemperature: { nominal: 25, unit: 'degC' },
    maxContinuousRuntime: { value: 2, unit: 'h' },
    installationOrientation: 'horizontal',
    environment: 'indoor',
    ventilation: 'sealed',
    ...overrides,
  };
}

function graph(nodes: Array<[string, string, Record<string, unknown>]>,
  connections: Array<[string, string, string, string]> = []): ProductGraph {
  return propagate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'graph_thermal',
    name: 'Thermal fixture',
    nodes: nodes.map(([id, type, parameters]) => ({
      id, type, category: 'hardware' as const, parameters,
      capabilities: {}, requirements: {}, derivedMetrics: {}, constraints: [],
      connectedNodes: [], position: { x: 0, y: 0 }, maturity: 'concept' as const,
    })),
    connections: connections.map(([id, from, to, type]) => ({
      id, from, to, type: type as 'power' | 'control' | 'data' | 'mechanical',
    })),
    userMode: 'builder',
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  }).graph;
}

/**
 * A pack, a controller, a driver and a motor.
 *
 * `regulator` declares the controller board's onboard regulator theta — the
 * part whose temperature the rule estimates. The driver's own theta is separate
 * and is not substituted for it.
 */
function driveTrain(regulator: Record<string, unknown> = {}) {
  return graph(
    [
      ['n1_battery', 'battery', { chemistry: 'nimh', cellCount: 4, dischargeRating: 5 }],
      ['n2_controller', 'controller', regulator],
      ['n3_driver', 'driver', { rdsOnMilliohm: 500 }],
      ['n4_motor', 'motor', { motorType: 'dc-brushed', ratedVoltageV: 4.8, stallCurrentA: 1.5 }],
    ],
    [
      ['c1', 'n1_battery', 'n2_controller', 'power'],
      ['c2', 'n1_battery', 'n3_driver', 'power'],
      ['c3', 'n3_driver', 'n4_motor', 'power'],
    ],
  );
}

describe('thermal — the existing rule, finally given inputs', () => {
  it('is UNKNOWN with no operating profile, never room temperature assumed', () => {
    const result = assessThermal(driveTrain(), null);

    expect(result.verdict).toBe('UNKNOWN');
    expect(result.estimatedTemperatureC).toBeNull();
    expect(result.detail).toContain('ambient temperature is unknown');
    expect(result.detail).toContain('not a pass');
  });

  it('is UNKNOWN when the graph publishes no current at all', () => {
    const empty = graph([['n1_app', 'operator-app', {}]]);
    const result = assessThermal(empty, profile());

    expect(result.verdict).toBe('UNKNOWN');
    expect(result.detail).toContain('no current draw');
    expect(result.detail).toContain('not a pass');
  });

  it('refuses to estimate a temperature when thermal resistance is unknown', () => {
    // No regulator theta is declared. F6 is skipped rather than run with a
    // guessed figure — which is what the rule has always done.
    const result = assessThermal(driveTrain(), profile());

    expect(result.verdict).toBe('UNKNOWN');
    expect(result.estimatedTemperatureC).toBeNull();
    expect(result.thermalResistanceClass).toBe('unknown');
    expect(result.detail).toContain('refused rather than guessed');
  });

  it('produces a temperature once a datasheet thermal resistance is declared', () => {
    const result = assessThermal(
      driveTrain({
        regulatorThermalResistanceKPerW: 40, regulatorThermalResistanceClass: 'datasheet',
      }),
      profile(),
    );

    expect(result.estimatedTemperatureC).not.toBeNull();
    expect(result.thermalResistanceClass).toBe('datasheet');
    // Above the 25 degC ambient it was given, because something dissipates.
    expect(result.estimatedTemperatureC as number).toBeGreaterThan(25);
    expect(result.verdict).toBe('PASS');
  });

  it('caps an estimated thermal resistance at requires-validation, never pass', () => {
    const result = assessThermal(
      driveTrain({
        regulatorThermalResistanceKPerW: 40, regulatorThermalResistanceClass: 'estimated',
      }),
      profile(),
    );

    // A margin computed from an estimate is a number waiting on a bench.
    expect(result.verdict).toBe('REQUIRES_VALIDATION');
    expect(result.detail).toContain('bench verification required');
  });

  it('follows the ambient it is given, not a fixed room', () => {
    const cool = assessThermal(
      driveTrain({
        regulatorThermalResistanceKPerW: 40, regulatorThermalResistanceClass: 'datasheet',
      }),
      profile({ ambientTemperature: { nominal: 20, unit: 'degC' } }),
    );
    const hot = assessThermal(
      driveTrain({
        regulatorThermalResistanceKPerW: 40, regulatorThermalResistanceClass: 'datasheet',
      }),
      profile({ ambientTemperature: { nominal: 45, unit: 'degC' } }),
    );

    expect((hot.estimatedTemperatureC as number) - (cool.estimatedTemperatureC as number))
      .toBeCloseTo(25, 6);
  });

  it('fails when a hot enough ambient pushes the estimate past the ceiling', () => {
    const result = assessThermal(
      driveTrain({
        regulatorThermalResistanceKPerW: 4000, regulatorThermalResistanceClass: 'datasheet',
      }),
      profile({ ambientTemperature: { nominal: 70, unit: 'degC' } }),
    );

    expect(result.verdict).toBe('FAIL');
    expect(result.thermalMarginK as number).toBeLessThan(0);
  });

  it('names the rule and version it used, so the working can be checked', () => {
    const result = assessThermal(driveTrain(), profile());

    expect(result.ruleId).toBe('SEC-POWER-THERMAL-001');
    expect(result.ruleVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is deterministic', () => {
    const a = assessThermal(driveTrain({ regulatorThermalResistanceKPerW: 40 }), profile());
    const b = assessThermal(driveTrain({ regulatorThermalResistanceKPerW: 40 }), profile());

    expect(a).toEqual(b);
  });

  it('weighs loads by the profile duty cycle', () => {
    const full = assessThermal(
      driveTrain({
        regulatorThermalResistanceKPerW: 40, regulatorThermalResistanceClass: 'datasheet',
      }),
      profile(),
    );
    const half = assessThermal(
      driveTrain({
        regulatorThermalResistanceKPerW: 40, regulatorThermalResistanceClass: 'datasheet',
      }),
      profile({ dutyCycle: { value: 0.5, unit: 'fraction' } }),
    );

    // Half the duty is half the average current, so less dissipation and a
    // cooler estimate.
    expect(half.estimatedTemperatureC as number)
      .toBeLessThan(full.estimatedTemperatureC as number);
  });

  it('reports driver dissipation alongside, never folded into the regulator', () => {
    const result = assessThermal(
      driveTrain({
        regulatorThermalResistanceKPerW: 40, regulatorThermalResistanceClass: 'datasheet',
      }),
      profile(),
    );

    // The driver loses real power, but the rule estimates the regulator's
    // temperature and the driver is not that part. Both numbers are visible and
    // neither is the other.
    expect(result.driverDissipationW).not.toBeNull();
    expect(result.driverDissipationW).not.toBe(result.dissipationW);
  });

  it('reports no driver dissipation when no driver resolved one', () => {
    const noDriver = graph(
      [
        ['n1_battery', 'battery', { chemistry: 'nimh', cellCount: 4, dischargeRating: 5 }],
        ['n2_controller', 'controller', {}],
      ],
      [['c1', 'n1_battery', 'n2_controller', 'power']],
    );

    // Null, not zero. A product with no driver has no driver loss to state.
    expect(assessThermal(noDriver, profile()).driverDissipationW).toBeNull();
  });

  it('reports the inputs the rule found absent rather than hiding them', () => {
    // No battery at all, so capacity and voltage cannot be resolved.
    const noPack = graph(
      [
        ['n1_controller', 'controller', {}],
        ['n2_motor', 'motor', { motorType: 'dc-brushed' }],
      ],
      [['c1', 'n1_controller', 'n2_motor', 'control']],
    );

    const result = assessThermal(noPack, profile());

    expect(result.missingInputs.length).toBeGreaterThan(0);
    expect(result.missingInputs).toEqual([...result.missingInputs].sort());
  });
});
