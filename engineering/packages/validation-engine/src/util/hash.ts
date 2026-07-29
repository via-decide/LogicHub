import { createHash } from 'node:crypto';
import { jcsCanonicalize } from './jcs.js';

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function sha256OfCanonical(value: unknown): string {
  return sha256Hex(jcsCanonicalize(value));
}
