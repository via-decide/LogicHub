import { describe, it, expect } from 'vitest';
import { OperatingProfileSchema } from '../src/index.js';

const valid = {
  ambientTemperature: { nominal: 25, minimum: 0, maximum: 50, unit: 'degC' as const },
  maxContinuousRuntime: { value: 8, unit: 'h' as const },
};

describe('OperatingProfileSchema', () => {
  it('parses a valid operating profile', () => {
    const result = OperatingProfileSchema.parse(valid);
    expect(result.ambientTemperature.nominal).toBe(25);
    expect(result.schemaVersion).toBe('0.1.0');
  });

  it('applies defaults for orientation, environment, ventilation', () => {
    const result = OperatingProfileSchema.parse(valid);
    expect(result.installationOrientation).toBe('horizontal');
    expect(result.environment).toBe('indoor');
    expect(result.ventilation).toBe('sealed');
  });

  it('accepts optional duty cycle and expected load', () => {
    const result = OperatingProfileSchema.parse({
      ...valid,
      dutyCycle: { value: 0.5, unit: 'fraction' as const },
      expectedLoad: { description: '12V LED strip', averagePower: { value: 14.4, unit: 'W' as const } },
    });
    expect(result.dutyCycle?.value).toBe(0.5);
    expect(result.expectedLoad?.averagePower?.value).toBe(14.4);
  });

  it('rejects duty cycle outside 0-1', () => {
    expect(() => OperatingProfileSchema.parse({
      ...valid,
      dutyCycle: { value: 1.5, unit: 'fraction' as const },
    })).toThrow();
  });

  it('rejects non-positive runtime', () => {
    expect(() => OperatingProfileSchema.parse({
      ...valid,
      maxContinuousRuntime: { value: 0, unit: 'h' as const },
    })).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => OperatingProfileSchema.parse({})).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = OperatingProfileSchema.parse(valid);
    const roundtripped = OperatingProfileSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(roundtripped).toEqual(parsed);
  });
});
