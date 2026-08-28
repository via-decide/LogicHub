import { randomUUID } from 'node:crypto';

export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

let lastIsoNowMs = 0;

/**
 * Strictly monotonically increasing ISO timestamp within this process. Two
 * events (e.g. two review submissions) that land in the same millisecond
 * must still be orderable -- code such as review-engine's
 * summarizeReviewState relies on createdAt to resolve "which of this
 * reviewer's decisions is latest", and a real collision there would
 * silently pick the wrong one via stable-sort tie-breaking.
 */
export function isoNow(): string {
  let ms = Date.now();
  if (ms <= lastIsoNowMs) ms = lastIsoNowMs + 1;
  lastIsoNowMs = ms;
  return new Date(ms).toISOString();
}
