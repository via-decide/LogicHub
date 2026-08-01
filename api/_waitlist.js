// LogicHub/api/_waitlist.js
// Confirmation tokens and rate limiting for the cartridge waiting list.
//
// Two problems with an open signup endpoint:
//
//   1. Anyone can type someone else's address, so an unconfirmed entry is a
//      claim about a third party, not consent from them. Nothing here counts an
//      address as a subscriber until its owner clicks a link only they received.
//   2. Anyone can post to it in a loop. A fixed-window counter keyed on a hashed
//      client address bounds that, and fails closed — refusing a signup is a
//      smaller harm than leaving an unbounded write endpoint open.
//
// The helpers are pure or take the database as an argument, so both rules can be
// tested without Firestore and without sending mail.

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

/** One hour, fixed window. Not a sliding window: a counter is enough here. */
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Signups allowed per client address per window. */
export const RATE_LIMIT_MAX = 5;

/**
 * Ceiling for requests that arrive with no usable client address.
 *
 * These all share one bucket, so the limit is looser — otherwise a handful of
 * header-less requests would lock out everyone else in the same position.
 */
export const RATE_LIMIT_UNKNOWN_MAX = 20;

/**
 * The secret used to sign confirmation links, or null.
 *
 * There is deliberately no default. A hardcoded fallback secret would let anyone
 * who read this file forge a confirmation for someone else's address, which is
 * the whole thing double opt-in exists to prevent. When it is absent the signup
 * is still recorded — it simply stays unconfirmed, and no forgeable link is sent.
 */
export function tokenSecret() {
  const secret = String(
    process.env.WAITLIST_TOKEN_SECRET || process.env.SECRET_KEY || '',
  ).trim();
  return secret.length >= 16 ? secret : null;
}

/**
 * A confirmation token for one address.
 *
 * The token is an HMAC over the address itself, so a link issued for one person
 * cannot be replayed to confirm another. It carries no expiry: the cost of an
 * old link still working is that someone confirms late, which is what they asked
 * for anyway.
 */
export function confirmationToken(email, secret) {
  if (!secret) throw new Error('A confirmation token cannot be made without a secret.');
  return createHmac('sha256', secret)
    .update(`waitlist:${normaliseEmail(email)}`)
    .digest('base64url');
}

/** Constant-time check, so a token cannot be discovered a character at a time. */
export function tokenMatches(email, supplied, secret) {
  if (!secret || !supplied) return false;

  const expected = Buffer.from(confirmationToken(email, secret), 'utf8');
  const given = Buffer.from(String(supplied), 'utf8');

  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

export function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * The rate-limit bucket for a request.
 *
 * The address is hashed before it is stored. Keeping raw IP addresses in a
 * counter collection would make a rate limiter into a log of who visited.
 */
export function clientBucket(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const address = forwarded || String(req.headers?.['x-real-ip'] || '').trim();

  if (!address) return { key: 'unknown', max: RATE_LIMIT_UNKNOWN_MAX };

  const secret = tokenSecret();
  const digest = secret
    ? createHmac('sha256', secret).update(address).digest('hex')
    // Without a secret this is only obfuscation — the IPv4 space is small
    // enough to reverse — but it is still better than storing the address.
    : createHash('sha256').update(address).digest('hex');

  return { key: digest.slice(0, 32), max: RATE_LIMIT_MAX };
}

/** Start of the fixed window containing `now`, in milliseconds. */
export function windowStart(now = Date.now()) {
  return Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
}

/**
 * Count this request against its bucket.
 *
 * Returns `{ allowed, count, max }`. Throws if the counter cannot be read or
 * written — the caller refuses the signup rather than proceeding uncounted.
 *
 * Atomic: a single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count`
 * against `db.raw` (the real Postgres client `_pg.js`'s `getAdminDb()`
 * exposes for exactly this — see `PostgresFirestoreCompat.raw`). The
 * generic document get-then-merge-set interface used elsewhere in this file
 * cannot express an atomic increment; a prior version of this function did
 * read-then-write through that interface, which could undercount under
 * concurrency. This version cannot, since the increment happens inside one
 * statement the database itself serializes.
 */
export async function countRequest(db, bucket, now = Date.now()) {
  const start = windowStart(now);
  const sql = db.raw;
  const rows = await sql`
    INSERT INTO waitlist_rate_limit_counters (bucket_key, window_start, count)
    VALUES (${bucket.key}, ${start}, 1)
    ON CONFLICT (bucket_key, window_start)
    DO UPDATE SET count = waitlist_rate_limit_counters.count + 1
    RETURNING count
  `;
  const count = rows[0].count;

  return { allowed: count <= bucket.max, count, max: bucket.max };
}
