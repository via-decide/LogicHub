import { describe, it, expect } from 'vitest';
import { canonicalize, canonicalCompact } from '../src/canonical/canonical-json.js';
import { hashValue, sha256Hex, byteLength } from '../src/canonical/hashing.js';

describe('Gate 6 — canonical serialization', () => {
  it('sorts object keys regardless of insertion order', () => {
    const a = canonicalize({ zebra: 1, apple: 2, mango: 3 });
    const b = canonicalize({ mango: 3, zebra: 1, apple: 2 });
    expect(a).toBe(b);
    expect(a.indexOf('apple')).toBeLessThan(a.indexOf('mango'));
  });

  it('sorts keys at every depth', () => {
    const a = canonicalize({ outer: { z: 1, a: 2 } });
    const b = canonicalize({ outer: { a: 2, z: 1 } });
    expect(a).toBe(b);
  });

  it('preserves array order, which is meaningful', () => {
    expect(canonicalCompact([3, 1, 2])).toBe('[3,1,2]');
  });

  it('treats an absent key and an undefined key identically', () => {
    expect(canonicalize({ a: 1 })).toBe(canonicalize({ a: 1, b: undefined }));
  });

  it('serializes empty containers compactly', () => {
    expect(canonicalCompact({ a: [], b: {} })).toBe('{"a":[],"b":{}}');
  });

  it('ends with a single trailing newline', () => {
    const output = canonicalize({ a: 1 });
    expect(output.endsWith('\n')).toBe(true);
    expect(output.endsWith('\n\n')).toBe(false);
  });

  it('round-trips through JSON.parse unchanged', () => {
    const value = { b: [1, 2, { c: true, a: null }], a: 'text' };
    expect(JSON.parse(canonicalize(value))).toEqual(value);
  });

  it('escapes strings the same way JSON does', () => {
    expect(canonicalCompact({ k: 'a"b\\c\nd' })).toBe(JSON.stringify({ k: 'a"b\\c\nd' }));
  });

  it('does not let negative zero produce different bytes', () => {
    expect(canonicalCompact({ v: -0 })).toBe(canonicalCompact({ v: 0 }));
  });

  it('refuses to serialize a value that cannot round-trip', () => {
    // Substituting null for NaN would silently turn a broken number into a
    // plausible-looking absent value.
    expect(() => canonicalize({ v: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalize({ v: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
  });

  it('hashes equal values to the same digest regardless of key order', () => {
    expect(hashValue({ a: 1, b: 2 })).toBe(hashValue({ b: 2, a: 1 }));
  });

  it('hashes different values to different digests', () => {
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
  });

  it('produces a 64-character lowercase hex digest', () => {
    expect(sha256Hex('anything')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('measures byte length in UTF-8, not code units', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('°')).toBe(2);
  });
});
