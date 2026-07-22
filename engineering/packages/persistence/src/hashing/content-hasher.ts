import { createHash } from 'node:crypto';

export function computeSha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
