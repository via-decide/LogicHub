import { describe, it, expect } from 'vitest';
import {
  ALL_PERMISSIONS,
  PERMISSION_GRANTS,
  assertPermitted,
  holdsPermission,
  permissionsFor,
} from '../src/schemas/authority.schema.js';
import { generateAllSurfaces, findAuthorityViolations } from '../src/generators/index.js';
import { roverGraph } from './helpers.js';

describe('Gate 5 — authority boundaries', () => {
  it('grants no single authority every permission', () => {
    // The whole point of splitting the surfaces is that none of them is the
    // unrestricted application.
    for (const authority of ['operator', 'engineering', 'service'] as const) {
      expect(permissionsFor(authority).length).toBeLessThan(ALL_PERMISSIONS.length);
    }
  });

  it('keeps configuration, calibration and flashing away from the operator', () => {
    for (const forbidden of [
      'config.write', 'pinmap.write', 'calibration.write',
      'firmware.parameters.write', 'firmware.flash', 'component.replace',
    ] as const) {
      expect(holdsPermission('operator', forbidden), forbidden).toBe(false);
    }
  });

  it('keeps driving the product away from engineering and service', () => {
    expect(holdsPermission('engineering', 'control.actuate')).toBe(false);
    expect(holdsPermission('service', 'control.actuate')).toBe(false);
    expect(holdsPermission('operator', 'control.actuate')).toBe(true);
  });

  it('keeps firmware flashing to service alone', () => {
    expect(holdsPermission('service', 'firmware.flash')).toBe(true);
    expect(holdsPermission('engineering', 'firmware.flash')).toBe(false);
    expect(holdsPermission('operator', 'firmware.flash')).toBe(false);
  });

  it('keeps design changes to engineering alone', () => {
    expect(holdsPermission('engineering', 'config.write')).toBe(true);
    expect(holdsPermission('service', 'config.write')).toBe(false);
    expect(holdsPermission('operator', 'config.write')).toBe(false);
  });

  it('keeps part replacement and evidence capture to service alone', () => {
    for (const permission of ['component.replace', 'evidence.capture', 'maintenance.write'] as const) {
      expect(holdsPermission('service', permission)).toBe(true);
      expect(holdsPermission('engineering', permission)).toBe(false);
      expect(holdsPermission('operator', permission)).toBe(false);
    }
  });

  it('gives every authority the ability to read status and alerts', () => {
    for (const authority of ['operator', 'engineering', 'service'] as const) {
      expect(holdsPermission(authority, 'status.read')).toBe(true);
      expect(holdsPermission(authority, 'alerts.read')).toBe(true);
    }
  });

  it('grants no permission outside the known set', () => {
    for (const granted of Object.values(PERMISSION_GRANTS)) {
      for (const permission of granted) {
        expect(ALL_PERMISSIONS).toContain(permission);
      }
    }
  });

  it('lists no permission twice within one grant', () => {
    for (const [authority, granted] of Object.entries(PERMISSION_GRANTS)) {
      expect(new Set(granted).size, authority).toBe(granted.length);
    }
  });

  it('throws when an action is attempted without authority', () => {
    expect(() => assertPermitted('operator', 'firmware.flash'))
      .toThrow(/operator surface does not hold firmware\.flash/);
    expect(() => assertPermitted('service', 'firmware.flash')).not.toThrow();
  });

  it('generates all three surfaces without a single authority violation', () => {
    const surfaces = generateAllSurfaces(roverGraph());
    for (const surface of [surfaces.operator, surfaces.engineering, surfaces.service]) {
      expect(findAuthorityViolations(surface), surface.authority).toEqual([]);
    }
  });

  it('detects a surface that reaches past its authority', () => {
    const surfaces = generateAllSurfaces(roverGraph());
    const tampered = {
      ...surfaces.operator,
      sections: [
        ...surfaces.operator.sections,
        {
          id: 'sneaky-firmware',
          title: 'Firmware',
          requiresPermission: 'firmware.flash' as const,
          controls: [],
          readouts: [],
          emptyReason: null,
        },
      ],
    };

    const violations = findAuthorityViolations(tampered);
    expect(violations).toHaveLength(1);
    expect(violations[0].permission).toBe('firmware.flash');
  });
});
