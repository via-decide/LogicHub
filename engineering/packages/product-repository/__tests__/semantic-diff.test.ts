import { describe, it, expect } from 'vitest';
import { semanticDiff } from '../src/diff/semantic-diff.js';
import { SemanticProductDiffSchema } from '../src/schemas/diff.schema.js';
import { ProductRepository } from '../src/repository/product-repository.js';
import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';
import type { ProductGraph } from '@logichub-engineering/product-graph';
import {
  FIXED_TIME, INTENT, STAMP, roverGraph, roverWithDriver, roverWithRegulatorTheta,
} from './helpers.js';

function repoWithBatteryChange() {
  const repo = new ProductRepository();
  const first = repo.commit({
    intent: INTENT, stamp: STAMP, graph: roverGraph(3),
    author: 'tester', message: 'Initial rover', createdAt: FIXED_TIME,
  });
  const second = repo.commit({
    intent: INTENT, stamp: STAMP, graph: roverGraph(4),
    author: 'tester', message: 'Move to a 4S pack', createdAt: FIXED_TIME,
  });
  return { repo, first, second, diff: semanticDiff(first, second) };
}

function area(diff: ReturnType<typeof semanticDiff>, name: string) {
  const found = diff.affectedAreas.find(a => a.area === name);
  if (!found) throw new Error(`No affected area "${name}"`);
  return found;
}

function check(diff: ReturnType<typeof semanticDiff>, id: string) {
  const found = diff.validationChecks.find(c => c.id === id);
  if (!found) throw new Error(`No check "${id}"`);
  return found;
}

describe('Gate 8 — semantic diff', () => {
  it('produces a schema-valid diff', () => {
    const { diff } = repoWithBatteryChange();
    expect(SemanticProductDiffSchema.safeParse(diff).success).toBe(true);
  });

  it('reports a battery change the way the change is actually discussed', () => {
    const { diff } = repoWithBatteryChange();
    const headline = diff.changes.find(c => c.field === 'cellCount')?.headline;
    expect(headline).toBe('Battery changed: 3S -> 4S');
  });

  it('reports the downstream metric changes the parameter caused', () => {
    const { diff } = repoWithBatteryChange();
    const fields = diff.changes.map(c => `${c.nodeType}.${c.field}`);

    expect(fields).toContain('battery.nominalVoltageV');
    expect(fields).toContain('battery.storedEnergyWh');
    expect(fields).toContain('battery.estimatedRuntimeH');

    // Peak current follows capacity and discharge rating, neither of which
    // moved, so it correctly reports no change.
    expect(fields).not.toContain('battery.peakCurrentA');
  });

  it('reports the motor speed change a supply change causes', () => {
    // Brushed motor speed tracks applied voltage, so a pack change moves the
    // wheels and the diff says by how much.
    const { diff } = repoWithBatteryChange();
    const speed = diff.changes.find(c => c.nodeType === 'motor' && c.field === 'speedMps');

    expect(speed).toBeDefined();
    expect(Number(speed!.after)).toBeGreaterThan(Number(speed!.before));
  });

  it('records which voltage the new speed was derived from', () => {
    const { diff } = repoWithBatteryChange();
    const basis = diff.changes.find(c => c.nodeType === 'motor' && c.field === 'appliedVoltageV');
    expect(basis?.after).toBe('14.8');
  });

  it('lists every area the spec names for a battery change', () => {
    const { diff } = repoWithBatteryChange();
    const areas = diff.affectedAreas.map(a => a.area);

    for (const expected of [
      'Motor voltage', 'Motor speed', 'Driver voltage', 'Regulator input',
      'Thermal load', 'Runtime', 'Firmware limits', 'Generated operator UI',
    ]) {
      expect(areas, `missing area ${expected}`).toContain(expected);
    }
  });

  it('marks thermal load affected but unevaluated with no operating profile', () => {
    // Ambient temperature is unknown without a profile, so the thermal rule
    // cannot run. Omitting the area would hide it; marking it evaluated would
    // be a lie.
    const { diff } = repoWithBatteryChange();
    const thermal = area(diff, 'Thermal load');

    expect(thermal.evaluated).toBe(false);
    expect(thermal.effect).toBeNull();
    expect(thermal.domain).toBe('thermal');
  });

  it('marks driver voltage and firmware limits unevaluated too', () => {
    // This rover has no driver node, so there is no stage to assess.
    const { diff } = repoWithBatteryChange();
    expect(area(diff, 'Driver voltage').evaluated).toBe(false);
    expect(area(diff, 'Firmware limits').evaluated).toBe(false);
  });

  it('reports the evaluated areas with what actually changed', () => {
    const { diff } = repoWithBatteryChange();
    expect(area(diff, 'Motor voltage').effect).toBe('Supply 11.1 V -> 14.8 V');
    expect(area(diff, 'Runtime').evaluated).toBe(true);
    expect(area(diff, 'Generated operator UI').evaluated).toBe(true);
  });

  it('quantifies the motor speed effect rather than just flagging the area', () => {
    const { diff } = repoWithBatteryChange();
    const speed = area(diff, 'Motor speed');

    expect(speed.evaluated).toBe(true);
    expect(speed.effect).toMatch(/^speedMps /);
    expect(speed.reason).toMatch(/follows the supply/);
  });

  it('flags that some affected areas were not evaluated', () => {
    const { diff } = repoWithBatteryChange();
    expect(diff.hasUnevaluatedAreas).toBe(true);
    expect(diff.summary).toMatch(/could not be evaluated and are not passes/);
  });

  it('reports the regulator consequence of the new supply', () => {
    const { diff } = repoWithBatteryChange();
    // 14.8 V is past what an ESP32 board input accepts.
    expect(area(diff, 'Regulator input').effect).toMatch(/requires a regulator stage/);
    expect(check(diff, 'controller.input').verdict).toBe('FAIL');
  });

  it('never reports an unrunnable check as a pass', () => {
    const { diff } = repoWithBatteryChange();
    expect(check(diff, 'driver.margin').verdict).toBe('UNKNOWN');
    expect(check(diff, 'driver.margin').detail).toMatch(/This is not a pass/);
    expect(check(diff, 'thermal.load').verdict).toBe('UNKNOWN');
    expect(check(diff, 'thermal.load').detail).toMatch(/This is not a pass/);
  });

  it('passes the supply checks when everything stays in band', () => {
    // A 2-cell pack at 7.4 V sits inside both the board input range and the
    // motor tolerance band.
    const repo = new ProductRepository();
    const first = repo.commit({
      intent: INTENT, stamp: STAMP, graph: roverGraph(2, 8),
      author: 'tester', message: 'Initial', createdAt: FIXED_TIME,
    });
    const diff = semanticDiff(null, first);

    expect(check(diff, 'motor.voltage').verdict).toBe('PASS');
    expect(check(diff, 'controller.input').verdict).toBe('PASS');
  });

  it('reports no change between a revision and itself', () => {
    const { second } = repoWithBatteryChange();
    const diff = semanticDiff(second, second);

    expect(diff.changes).toEqual([]);
    expect(diff.affectedAreas).toEqual([]);
    expect(diff.summary).toMatch(/No semantic change/);
  });

  it('reports an added node as composition rather than a value change', () => {
    const repo = new ProductRepository();
    const base = roverGraph(3);
    const first = repo.commit({
      intent: INTENT, stamp: STAMP, graph: base,
      author: 'tester', message: 'Initial', createdAt: FIXED_TIME,
    });
    const withSensor = {
      ...base,
      nodes: [...base.nodes, {
        ...base.nodes[2]!, id: 'n7_sensor', type: 'sensor', parameters: { sensorType: 'distance' },
      }],
    };
    const second = repo.commit({
      intent: INTENT, stamp: STAMP, graph: withSensor,
      author: 'tester', message: 'Add sensor', createdAt: FIXED_TIME,
    });

    const diff = semanticDiff(first, second);
    expect(diff.changes.some(c => c.kind === 'node-added')).toBe(true);
    expect(diff.affectedAreas.some(a => a.area.startsWith('Product composition'))).toBe(true);
  });

  it('produces the same diff for the same pair every time', () => {
    const { first, second } = repoWithBatteryChange();
    const baseline = JSON.stringify(semanticDiff(first, second));
    for (let i = 0; i < 5; i += 1) {
      expect(JSON.stringify(semanticDiff(first, second))).toBe(baseline);
    }
  });
});

describe('Gate 8 — thermal and driver, once the model can reach them', () => {
  const profile = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ambientTemperature: { nominal: 25, unit: 'degC' as const },
    maxContinuousRuntime: { value: 2, unit: 'h' as const },
    installationOrientation: 'horizontal' as const,
    environment: 'indoor' as const,
    ventilation: 'sealed' as const,
  };

  function diffWith(
    graphBefore: ProductGraph,
    graphAfter: ProductGraph,
    operatingProfile: typeof profile | null,
  ) {
    const repo = new ProductRepository();
    const first = repo.commit({
      intent: INTENT, stamp: STAMP, graph: graphBefore,
      author: 'tester', message: 'before', createdAt: FIXED_TIME,
    });
    const second = repo.commit({
      intent: INTENT, stamp: STAMP, graph: graphAfter,
      author: 'tester', message: 'after', createdAt: FIXED_TIME,
    });
    return semanticDiff(first, second, operatingProfile);
  }

  it('leaves thermal UNKNOWN when the profile declares no regulator theta', () => {
    // A profile supplies ambient, but nobody declared the regulator's
    // junction-to-ambient resistance. F6 is skipped, not guessed at.
    const diff = diffWith(roverGraph(3), roverGraph(4), profile);

    expect(check(diff, 'thermal.load').verdict).toBe('UNKNOWN');
    expect(check(diff, 'thermal.load').detail).toContain('SEC-POWER-THERMAL-001');
    expect(area(diff, 'Thermal load').evaluated).toBe(false);
  });

  it('evaluates thermal load once ambient and a theta both exist', () => {
    const before = roverWithRegulatorTheta(3);
    const after = roverWithRegulatorTheta(4);

    const diff = diffWith(before, after, profile);
    const thermal = check(diff, 'thermal.load');

    // The gap Gate 8 recorded is closed by the rule running, not by the area
    // being quietly marked done.
    expect(thermal.verdict).not.toBe('UNKNOWN');
    expect(area(diff, 'Thermal load').evaluated).toBe(true);
    expect(area(diff, 'Thermal load').effect).toContain('degC estimated');
  });

  it('caps an estimated theta at requires-validation even with room to spare', () => {
    // A well-heatsunk regulator: 10 K/W leaves the estimate far under the
    // ceiling. It still cannot pass, because the resistance it was computed
    // from is somebody's estimate rather than a measurement.
    const diff = diffWith(
      roverWithRegulatorTheta(3, 'estimated', 10),
      roverWithRegulatorTheta(4, 'estimated', 10),
      profile,
    );

    expect(check(diff, 'thermal.load').verdict).toBe('REQUIRES_VALIDATION');
  });

  it('fails a linear regulator that would genuinely cook', () => {
    // 4S lipo at 14.8 V down to a 3.3 V logic rail is 11.5 V across the pass
    // element. At the ESP32's active current in a small package that is a real
    // over-temperature, and the rule says so rather than warning politely.
    const diff = diffWith(roverWithRegulatorTheta(3), roverWithRegulatorTheta(4), profile);

    expect(check(diff, 'thermal.load').verdict).toBe('FAIL');
    expect(check(diff, 'thermal.load').detail).toContain('exceeds');
  });

  it('evaluates driver margin once a driver stage is in the graph', () => {
    const diff = diffWith(roverWithDriver(3), roverWithDriver(4), profile);

    expect(check(diff, 'driver.margin').verdict).not.toBe('UNKNOWN');
    expect(area(diff, 'Driver voltage').evaluated).toBe(true);
  });

  it('reports driver margin as UNKNOWN when no driver is modelled', () => {
    const diff = diffWith(roverGraph(3), roverGraph(4), profile);
    const driver = check(diff, 'driver.margin');

    expect(driver.verdict).toBe('UNKNOWN');
    expect(driver.detail).toContain('not a pass');
  });
});
