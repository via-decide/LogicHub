import { describe, it, expect } from 'vitest';
import {
  COMPONENT_CATALOGUE,
  componentsForNodeType,
  getComponent,
  requireComponent,
} from '../src/catalogue/components.js';
import { PhysicalComponentSchema } from '../src/schemas/component.schema.js';

describe('Gate 4 — physical component catalogue', () => {
  it('validates every entry against the component schema', () => {
    for (const component of COMPONENT_CATALOGUE) {
      const result = PhysicalComponentSchema.safeParse(component);
      expect(result.success, `${component.id} failed schema validation`).toBe(true);
    }
  });

  it('uses unique component ids', () => {
    const ids = COMPONENT_CATALOGUE.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries no invented part numbers, SKUs, prices, or stock levels', () => {
    // Nothing here has been sourced, so nothing may claim to have been.
    for (const component of COMPONENT_CATALOGUE) {
      expect(component.sourcing.state).toBe('UNSOURCED');
      expect(component.sourcing.manufacturerPartNumber).toBeNull();
      expect(component.sourcing.supplierSku).toBeNull();
      expect(component.sourcing.cost.state).toBe('UNKNOWN');
      expect(component.sourcing.availability).toBe('UNKNOWN');
    }
  });

  it('records where every electrical envelope came from', () => {
    for (const component of COMPONENT_CATALOGUE) {
      if (component.electrical === null) continue;
      expect(['GENERIC_FAMILY', 'DATASHEET', 'MEASURED'])
        .toContain(component.electrical.envelopeSource);
      expect(component.electrical.supplyVoltageMaxV)
        .toBeGreaterThanOrEqual(component.electrical.supplyVoltageMinV);
    }
  });

  it('claims datasheet figures only for a named part family', () => {
    // A generic figure may be anonymous; a datasheet figure is a claim about a
    // specific part and must say which.
    for (const component of COMPONENT_CATALOGUE) {
      if (component.electrical?.envelopeSource !== 'DATASHEET') continue;
      expect(component.partFamily, component.id).not.toBeNull();
      expect(component.notes, component.id).toMatch(/confirm them against the datasheet/i);
    }
  });

  it('keeps unnamed parts on generic family figures', () => {
    for (const component of COMPONENT_CATALOGUE) {
      if (component.electrical === null || component.partFamily !== null) continue;
      expect(component.electrical.envelopeSource, component.id).toBe('GENERIC_FAMILY');
    }
  });

  it('covers the first-release component families the scope requires', () => {
    const families = new Set(COMPONENT_CATALOGUE.map(c => c.family));
    for (const required of [
      'controller', 'motor-driver', 'motor', 'battery', 'sensor',
      'connectivity', 'display', 'input', 'output',
    ]) {
      expect(families.has(required as never), `missing family ${required}`).toBe(true);
    }
  });

  it('offers the three required controller families', () => {
    const partFamilies = componentsForNodeType('controller').map(c => c.partFamily);
    expect(partFamilies).toContain('ESP32');
    expect(partFamilies).toContain('RP2040');
    expect(partFamilies).toContain('RP2350');
  });

  it('provides a TB6612-class driver profile', () => {
    const driver = requireComponent('driver-tb6612');
    expect(driver.partFamily).toBe('TB6612FNG');
    expect(driver.providesCapabilities['driver.h-bridge']).toBe(true);
  });

  it('maps sensors and motors onto graph node types', () => {
    expect(componentsForNodeType('sensor').length).toBeGreaterThanOrEqual(4);
    expect(componentsForNodeType('motor').length).toBeGreaterThanOrEqual(1);
    expect(componentsForNodeType('battery').length).toBeGreaterThanOrEqual(2);
  });

  it('maps parts to the node types that now exist for them', () => {
    expect(requireComponent('mechanical-chassis-2wd').satisfiesNodeType).toBeNull();
    expect(requireComponent('driver-tb6612').satisfiesNodeType).toBe('driver');
  });

  it('does not claim a rating for the prototype enclosure', () => {
    const enclosure = requireComponent('enclosure-prototype');
    expect(enclosure.notes).toMatch(/no ingress, drop, or flammability rating/);
  });

  it('restricts the relay to low-voltage loads', () => {
    const relay = requireComponent('actuator-relay-module');
    expect(relay.notes).toMatch(/restricted to low-voltage loads/);
    expect(relay.notes).toMatch(/[Mm]ains-voltage switching is out of scope/);
  });

  it('returns undefined for an unknown component and throws on require', () => {
    expect(getComponent('nope')).toBeUndefined();
    expect(() => requireComponent('nope')).toThrow(/Unknown component/);
  });
});
