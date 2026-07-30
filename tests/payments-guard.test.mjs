// LogicHub/tests/payments-guard.test.mjs
// Regression tests for the payment guards.
//
// A live Razorpay key once sat in this codebase as a hardcoded fallback, so a
// deploy could take real money without anyone deciding it should. These tests
// exist so that cannot come back quietly.
//
// Run: node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentsEnabled,
  razorpayCredentials,
  allowedOrigins,
  applyCors,
  paymentsDisabledResponse,
} from '../api/_payments-config.js';

function mockRes() {
  const res = {
    headers: {},
    setHeader(key, value) { res.headers[key] = value; },
    status(code) { res.code = code; return res; },
    json(body) { res.body = body; return res; },
    end() { return res; },
  };
  return res;
}

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

test('payments are off unless explicitly enabled', () => {
  withEnv({ PAYMENTS_ENABLED: undefined }, () => assert.equal(paymentsEnabled(), false));
  withEnv({ PAYMENTS_ENABLED: '' }, () => assert.equal(paymentsEnabled(), false));
  withEnv({ PAYMENTS_ENABLED: 'false' }, () => assert.equal(paymentsEnabled(), false));
  // Not enabled by anything that merely looks affirmative.
  withEnv({ PAYMENTS_ENABLED: '1' }, () => assert.equal(paymentsEnabled(), false));
  withEnv({ PAYMENTS_ENABLED: 'yes' }, () => assert.equal(paymentsEnabled(), false));
});

test('payments are on only for the exact opt-in value', () => {
  withEnv({ PAYMENTS_ENABLED: 'true' }, () => assert.equal(paymentsEnabled(), true));
  withEnv({ PAYMENTS_ENABLED: 'TRUE' }, () => assert.equal(paymentsEnabled(), true));
});

test('credentials throw rather than falling back to a hardcoded key', () => {
  withEnv({ RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined }, () => {
    assert.throws(() => razorpayCredentials(), /RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET/);
  });
});

test('a missing secret is never substituted with an empty string', () => {
  withEnv({ RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: undefined }, () => {
    assert.throws(() => razorpayCredentials(), /RAZORPAY_KEY_SECRET is not set/);
  });
  withEnv({ RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: '   ' }, () => {
    assert.throws(() => razorpayCredentials(), /RAZORPAY_KEY_SECRET is not set/);
  });
});

test('credentials come back only when both are present', () => {
  withEnv({ RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'shh' }, () => {
    assert.deepEqual(razorpayCredentials(), { keyId: 'rzp_test_x', keySecret: 'shh' });
  });
});

test('no live key is embedded in the configuration', async () => {
  const { readFileSync } = await import('node:fs');
  for (const file of ['api/_payments-config.js', 'api/checkout.js', 'api/verify-payment.js']) {
    const source = readFileSync(file, 'utf8');
    assert.ok(!/rzp_live_[A-Za-z0-9]/.test(source), `${file} contains a live key`);
  }
});

test('a disallowed origin is refused', () => {
  const res = mockRes();
  const allowed = applyCors({ headers: { origin: 'https://evil.example' } }, res);
  assert.equal(allowed, false);
  assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
});

test('an allowed origin is echoed, never a wildcard', () => {
  const res = mockRes();
  const allowed = applyCors({ headers: { origin: 'https://logichub.app' } }, res);

  assert.equal(allowed, true);
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://logichub.app');
  // A wildcard origin with credentials is rejected by browsers outright.
  assert.notEqual(res.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(res.headers['Access-Control-Allow-Credentials'], 'true');
});

test('responses vary on origin so a cache cannot leak one to another', () => {
  const res = mockRes();
  applyCors({ headers: { origin: 'https://logichub.app' } }, res);
  assert.equal(res.headers.Vary, 'Origin');
});

test('a request with no origin is allowed without CORS headers', () => {
  const res = mockRes();
  assert.equal(applyCors({ headers: {} }, res), true);
  assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
});

test('extra origins can be added by environment', () => {
  withEnv({ PAYMENTS_ALLOWED_ORIGINS: 'https://staging.logichub.app' }, () => {
    assert.ok(allowedOrigins().includes('https://staging.logichub.app'));
    assert.ok(allowedOrigins().includes('https://logichub.app'));
  });
});

test('the disabled response says plainly that nothing was charged', () => {
  const res = mockRes();
  paymentsDisabledResponse(res);

  assert.equal(res.code, 503);
  assert.equal(res.body.error, 'payments_disabled');
  assert.match(res.body.message, /No charge has been made/);
  assert.match(res.body.message, /no order has been created/);
  assert.equal(res.body.waitlist, '/waitlist');
});
