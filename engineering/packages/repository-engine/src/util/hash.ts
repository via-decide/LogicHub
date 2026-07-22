import { createHash } from 'node:crypto';
import { jcsCanonicalize } from './jcs.js';

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function sha256OfCanonical(value: unknown): string {
  return sha256Hex(jcsCanonicalize(value));
}

export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(v => canonicalJson(v)).join(',') + ']';
  }
  const sorted = Object.keys(value as Record<string, unknown>).sort();
  const pairs = sorted.map(k => {
    const v = (value as Record<string, unknown>)[k];
    if (v === undefined) return null;
    return JSON.stringify(k) + ':' + canonicalJson(v);
  }).filter(p => p !== null);
  return '{' + pairs.join(',') + '}';
}
