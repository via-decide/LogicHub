import { jcsCanonicalize } from '../util/jcs.js';
import { sha256Hex } from '../util/hash.js';
import type { RuleResult } from '../contracts/rule-result.schema.js';
import type { UnhashedRuleResult } from '../rules/shared.js';

/**
 * Canonical result hashing: SHA-256 over the RFC 8785 JCS form of the result
 * with the resultHash field absent. Deterministic across runs and platforms.
 */
export function hashRuleResult(result: UnhashedRuleResult): RuleResult {
  const resultHash = sha256Hex(jcsCanonicalize(result));
  return { ...result, resultHash };
}

/** Canonical bytes of any kernel document (JCS, UTF-8). */
export function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(jcsCanonicalize(value), 'utf-8');
}
