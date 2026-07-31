import { createHash } from 'node:crypto';
import { canonicalCompact } from './canonical-json.js';

export function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/** Hash of a value's canonical form, independent of key order. */
export function hashValue(value: unknown): string {
  return sha256Hex(canonicalCompact(value));
}

/** Byte length of a UTF-8 string, as it will be written to disk. */
export function byteLength(content: string): number {
  return Buffer.byteLength(content, 'utf8');
}
