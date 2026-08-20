// LogicHub/tests/waitlist.test.mjs
// Regression tests for waiting-list consent and rate limiting.
//
// The signup endpoint used to store an address as a subscriber the moment
// anyone typed it, and had no bound on how often it could be called. These tests
// pin both fixes.
//
// Run: node --test "tests/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RATE_LIMIT_COLLECTION,
  RATE_LIMIT_MAX,
  RATE_LIMIT_UNKNOWN_MAX,
  RATE_LIMIT_WINDOW_MS,
  clientBucket,
  confirmationToken,
  countRequest,
  normaliseEmail,
  tokenMatches,
  tokenSecret,
  windowStart,
} from '../api/_waitlist.js';

const SECRET = 'a-secret-long-enough-to-be-used';

function withEnv(values, run) {
  const saved = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function fakeDb() {
  const store = new Map();
  return {
    collection(name) {
      assert.equal(name, RATE_LIMIT_COLLECTION);
      return {
        doc(id) {
          return {
            async get() {
              const data = store.get(id);
              return { exists: data !== undefined, data: () => ({ ...data }) };
            },
            async set(data, options = {}) {
              const base = options.merge ? store.get(id) || {} : {};
              store.set(id, { ...base, ...data });
            },
          };
        },
      };
    },
    ids() {
      return [...store.keys()];
    },
  };
}

const request = (ip) => ({ headers: ip ? { 'x-forwarded-for': ip } : {} });

// --- consent -----------------------------------------------------------------

test('the deployed waitlist handlers load using declared runtime dependencies', async () => {
  const signup = await import('../api/waitlist.js');
  const confirmation = await import('../api/waitlist-confirm.js');

  assert.equal(typeof signup.default, 'function');
  assert.equal(typeof confirmation.default, 'function');
});

test('there is no default signing secret', () => {
  withEnv({ WAITLIST_TOKEN_SECRET: undefined, SECRET_KEY: undefined }, () => {
    assert.equal(tokenSecret(), null);
  });
});

test('a secret too short to be one is not accepted', () => {
  withEnv({ WAITLIST_TOKEN_SECRET: 'short', SECRET_KEY: undefined }, () => {
    assert.equal(tokenSecret(), null);
  });
});

test('a token cannot be made without a secret', () => {
  assert.throws(() => confirmationToken('a@b.com', null), /without a secret/);
});

test('a token confirms only the address it was issued for', () => {
  const mine = confirmationToken('me@example.com', SECRET);

  assert.equal(tokenMatches('me@example.com', mine, SECRET), true);
  // The whole point: a link sent to one person cannot confirm another.
  assert.equal(tokenMatches('someone.else@example.com', mine, SECRET), false);
});

test('a token from a different secret does not match', () => {
  const forged = confirmationToken('me@example.com', 'another-secret-entirely-x');
  assert.equal(tokenMatches('me@example.com', forged, SECRET), false);
});

test('an absent or empty token never matches', () => {
  assert.equal(tokenMatches('me@example.com', '', SECRET), false);
  assert.equal(tokenMatches('me@example.com', undefined, SECRET), false);
  assert.equal(tokenMatches('me@example.com', 'x', SECRET), false);
});

test('with no secret configured, nothing matches', () => {
  assert.equal(tokenMatches('me@example.com', 'anything', null), false);
});

test('the address is normalised, so case and spacing cannot fork an entry', () => {
  assert.equal(normaliseEmail('  ME@Example.COM '), 'me@example.com');
  const token = confirmationToken('me@example.com', SECRET);
  assert.equal(tokenMatches('  ME@Example.COM ', token, SECRET), true);
});

// --- rate limiting -----------------------------------------------------------

test('a client address is hashed, never stored as itself', () => {
  const bucket = clientBucket(request('203.0.113.9'));
  assert.equal(bucket.max, RATE_LIMIT_MAX);
  assert.ok(!bucket.key.includes('203.0.113.9'));
  assert.match(bucket.key, /^[0-9a-f]{32}$/);
});

test('different addresses land in different buckets', () => {
  assert.notEqual(
    clientBucket(request('203.0.113.9')).key,
    clientBucket(request('203.0.113.10')).key,
  );
});

test('only the first hop of x-forwarded-for is used', () => {
  assert.equal(
    clientBucket(request('203.0.113.9, 70.41.3.18')).key,
    clientBucket(request('203.0.113.9')).key,
  );
});

test('a request with no address gets a shared bucket with a looser ceiling', () => {
  const bucket = clientBucket(request(null));
  assert.equal(bucket.key, 'unknown');
  assert.equal(bucket.max, RATE_LIMIT_UNKNOWN_MAX);
  assert.ok(RATE_LIMIT_UNKNOWN_MAX > RATE_LIMIT_MAX);
});

test('requests are allowed up to the ceiling and refused past it', async () => {
  const db = fakeDb();
  const bucket = clientBucket(request('203.0.113.9'));
  const now = 1_800_000_000_000;

  for (let i = 1; i <= RATE_LIMIT_MAX; i += 1) {
    const result = await countRequest(db, bucket, now);
    assert.equal(result.allowed, true, `request ${i} should be allowed`);
    assert.equal(result.count, i);
  }

  const over = await countRequest(db, bucket, now);
  assert.equal(over.allowed, false);
  assert.equal(over.count, RATE_LIMIT_MAX + 1);
});

test('the counter resets in the next window', async () => {
  const db = fakeDb();
  const bucket = clientBucket(request('203.0.113.9'));
  const now = 1_800_000_000_000;

  for (let i = 0; i <= RATE_LIMIT_MAX; i += 1) await countRequest(db, bucket, now);

  const next = await countRequest(db, bucket, now + RATE_LIMIT_WINDOW_MS);
  assert.equal(next.allowed, true);
  assert.equal(next.count, 1);
});

test('one client hitting the limit does not refuse another', async () => {
  const db = fakeDb();
  const now = 1_800_000_000_000;
  const noisy = clientBucket(request('203.0.113.9'));
  const quiet = clientBucket(request('198.51.100.4'));

  for (let i = 0; i <= RATE_LIMIT_MAX; i += 1) await countRequest(db, noisy, now);

  assert.equal((await countRequest(db, quiet, now)).allowed, true);
});

test('the window is a fixed boundary, not the time of first request', () => {
  const start = windowStart(1_800_000_123_456);
  assert.equal(start % RATE_LIMIT_WINDOW_MS, 0);
  assert.equal(windowStart(start), start);
  assert.equal(windowStart(start + RATE_LIMIT_WINDOW_MS - 1), start);
  assert.equal(windowStart(start + RATE_LIMIT_WINDOW_MS), start + RATE_LIMIT_WINDOW_MS);
});

test('a counter failure propagates so the caller can fail closed', async () => {
  const broken = {
    collection() {
      return { doc() { return { async get() { throw new Error('firestore down'); } }; } };
    },
  };

  await assert.rejects(
    () => countRequest(broken, clientBucket(request('203.0.113.9'))),
    /firestore down/,
  );
});
