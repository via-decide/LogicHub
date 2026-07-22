import canonicalize = require('canonicalize');

const serialize = canonicalize.default ?? canonicalize;

export function jcsCanonicalize(value: unknown): string {
  const result = (serialize as (v: unknown) => string | undefined)(value);
  if (result === undefined) {
    throw new Error('JCS canonicalization failed: value is not serializable');
  }
  return result;
}

export function jcsCanonicalizeToBuffer(value: unknown): Buffer {
  return Buffer.from(jcsCanonicalize(value), 'utf-8');
}
