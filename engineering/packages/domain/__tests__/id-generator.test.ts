import { describe, it, expect } from 'vitest';
import { isoNow, generateId } from '../src/id-generator.js';

describe('isoNow', () => {
  it('never returns the same timestamp twice, even called back-to-back', () => {
    const timestamps = Array.from({ length: 50 }, () => isoNow());
    expect(new Set(timestamps).size).toBe(timestamps.length);
  });

  it('is strictly increasing', () => {
    const timestamps = Array.from({ length: 20 }, () => isoNow());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i] > timestamps[i - 1]).toBe(true);
    }
  });

  it('returns a valid ISO 8601 string', () => {
    expect(() => new Date(isoNow()).toISOString()).not.toThrow();
  });
});

describe('generateId', () => {
  it('prefixes with the given string and is unique', () => {
    const ids = Array.from({ length: 20 }, () => generateId('rev'));
    expect(ids.every((id) => id.startsWith('rev_'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
