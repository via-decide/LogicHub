import { describe, it, expect } from 'vitest';
import { MaterialProfileSchema } from '../src/index.js';

const valid = {
  name: 'PETG',
  materialClass: 'thermoplastic' as const,
  thermal: {
    maxServiceTemp: { value: 73, unit: 'degC' as const },
    glassTransition: { value: 80, unit: 'degC' as const },
    thermalConductivity: { value: 0.29, unit: 'W_per_mK' as const },
  },
};

describe('MaterialProfileSchema', () => {
  it('parses a valid material profile', () => {
    const result = MaterialProfileSchema.parse(valid);
    expect(result.name).toBe('PETG');
    expect(result.schemaVersion).toBe('0.1.0');
  });

  it('accepts full print properties', () => {
    const result = MaterialProfileSchema.parse({
      ...valid,
      print: {
        technology: 'fdm' as const,
        layerAdhesionFactor: 0.7,
        minimumWallThickness: { value: 1.2, unit: 'mm' as const },
        recommendedPerimeters: 3,
      },
    });
    expect(result.print?.technology).toBe('fdm');
    expect(result.print?.layerAdhesionFactor).toBe(0.7);
  });

  it('accepts mechanical properties', () => {
    const result = MaterialProfileSchema.parse({
      ...valid,
      mechanical: {
        tensileStrength: { value: 50, unit: 'MPa' as const },
        flexuralModulus: { value: 2100, unit: 'MPa' as const },
      },
    });
    expect(result.mechanical?.tensileStrength?.value).toBe(50);
  });

  it('rejects invalid material class', () => {
    expect(() => MaterialProfileSchema.parse({ ...valid, materialClass: 'wood' })).toThrow();
  });

  it('rejects missing thermal.maxServiceTemp', () => {
    expect(() => MaterialProfileSchema.parse({
      name: 'Bad',
      materialClass: 'thermoplastic',
      thermal: {},
    })).toThrow();
  });

  it('rejects layer adhesion factor outside 0-1', () => {
    expect(() => MaterialProfileSchema.parse({
      ...valid,
      print: { technology: 'fdm', layerAdhesionFactor: 1.5 },
    })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = MaterialProfileSchema.parse(valid);
    const roundtripped = MaterialProfileSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(roundtripped).toEqual(parsed);
  });
});
