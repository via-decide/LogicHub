import { describe, it, expect } from 'vitest';
import {
  aggregateAvailability,
  checkSupplyVoltage,
  totalCost,
} from '../src/matching/compatibility.js';
import { requireComponent } from '../src/catalogue/components.js';
import type { PhysicalComponent } from '../src/schemas/component.schema.js';

function priced(id: string, amount: number, currency = 'GBP'): PhysicalComponent {
  const base = requireComponent(id);
  return {
    ...base,
    sourcing: {
      ...base.sourcing,
      state: 'SOURCED',
      cost: {
        state: 'KNOWN', currency, amount,
        sourcedAt: '2026-01-01T00:00:00.000Z', sourceRef: 'test-fixture',
      },
      availability: 'IN_STOCK',
    },
  };
}

describe('Gate 4 — compatibility and aggregation', () => {
  it('accepts a supply inside a component envelope', () => {
    const verdict = checkSupplyVoltage(requireComponent('sensor-distance-ultrasonic'), 4.8);
    expect(verdict.compatible).toBe(true);
    expect(verdict.unknown).toBe(false);
  });

  it('rejects a supply above the envelope', () => {
    const verdict = checkSupplyVoltage(requireComponent('sensor-distance-ultrasonic'), 14.8);
    expect(verdict.compatible).toBe(false);
    expect(verdict.unknown).toBe(false);
    expect(verdict.message).toMatch(/accepts at most/);
  });

  it('rejects a supply below the envelope', () => {
    const verdict = checkSupplyVoltage(requireComponent('actuator-micro-servo'), 3.3);
    expect(verdict.compatible).toBe(false);
    expect(verdict.message).toMatch(/needs at least/);
  });

  it('accepts a supply sitting exactly on an envelope boundary', () => {
    const component = requireComponent('actuator-micro-servo');
    expect(checkSupplyVoltage(component, component.electrical!.supplyVoltageMinV).compatible)
      .toBe(true);
    expect(checkSupplyVoltage(component, component.electrical!.supplyVoltageMaxV).compatible)
      .toBe(true);
  });

  it('reports unknown, not compatible, when the supply is not known', () => {
    const verdict = checkSupplyVoltage(requireComponent('sensor-light'), undefined);
    expect(verdict.unknown).toBe(true);
    expect(verdict.compatible).toBe(false);
  });

  it('reports unknown for a component with no electrical envelope', () => {
    const verdict = checkSupplyVoltage(requireComponent('mechanical-chassis-2wd'), 4.8);
    expect(verdict.unknown).toBe(true);
    expect(verdict.compatible).toBe(false);
  });

  it('refuses to total a list containing any unpriced part', () => {
    const cost = totalCost([
      { component: priced('sensor-light', 2.5), quantity: 1 },
      { component: requireComponent('controller-esp32'), quantity: 1 },
    ]);
    expect(cost.state).toBe('UNKNOWN');
    if (cost.state === 'UNKNOWN') expect(cost.reason).toMatch(/1 of 2 components/);
  });

  it('totals a fully priced list, respecting quantity', () => {
    const cost = totalCost([
      { component: priced('sensor-light', 2.5), quantity: 2 },
      { component: priced('controller-esp32', 8), quantity: 1 },
    ]);
    expect(cost.state).toBe('KNOWN');
    if (cost.state === 'KNOWN') {
      expect(cost.amount).toBe(13);
      expect(cost.currency).toBe('GBP');
    }
  });

  it('refuses to total across mixed currencies', () => {
    const cost = totalCost([
      { component: priced('sensor-light', 2.5, 'GBP'), quantity: 1 },
      { component: priced('controller-esp32', 8, 'USD'), quantity: 1 },
    ]);
    expect(cost.state).toBe('UNKNOWN');
    if (cost.state === 'UNKNOWN') expect(cost.reason).toMatch(/more than one currency/);
  });

  it('lets one unknown component make the whole kit availability unknown', () => {
    expect(aggregateAvailability([
      { component: priced('sensor-light', 1) },
      { component: requireComponent('controller-esp32') },
    ])).toBe('UNKNOWN');
  });

  it('reports the worst known availability across a list', () => {
    const inStock = priced('sensor-light', 1);
    const outOfStock = {
      ...priced('controller-esp32', 8),
      sourcing: { ...priced('controller-esp32', 8).sourcing, availability: 'OUT_OF_STOCK' as const },
    };
    expect(aggregateAvailability([{ component: inStock }, { component: outOfStock }]))
      .toBe('OUT_OF_STOCK');
  });

  it('reports unknown for an empty list', () => {
    expect(aggregateAvailability([])).toBe('UNKNOWN');
  });
});
