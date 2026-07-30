// LogicHub/tests/orders.test.mjs
// Regression tests for the order record rules.
//
// An order used to exist only at Razorpay, so "was this order ours, and was it
// actually paid?" had no answer on this side. These tests pin the three rules
// that answer it.
//
// Run: node --test "tests/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDERS_COLLECTION,
  ORDER_CREATED,
  ORDER_PAID,
  orderRecord,
  saveOrder,
  markOrderPaid,
  recordVerificationRejection,
} from '../api/_orders.js';

/** A stand-in for the Firestore compat surface, holding documents in a Map. */
function fakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  const db = {
    writes: 0,
    collection(name) {
      assert.equal(name, ORDERS_COLLECTION);
      return {
        doc(id) {
          return {
            async get() {
              const data = store.get(id);
              return { exists: data !== undefined, data: () => ({ ...data }) };
            },
            async set(data, options = {}) {
              db.writes += 1;
              const base = options.merge ? store.get(id) || {} : {};
              store.set(id, { ...base, ...data });
            },
          };
        },
      };
    },
    read(id) {
      return store.get(id);
    },
    has(id) {
      return store.has(id);
    },
  };
  return db;
}

const BASE = {
  orderId: 'order_A1',
  packageId: 'starter',
  amount: 9900,
  currency: 'INR',
  country: 'IN',
  createdAt: '2026-01-01T00:00:00.000Z',
};

test('a new order starts unpaid with no payment attached', () => {
  const record = orderRecord(BASE);
  assert.equal(record.status, ORDER_CREATED);
  assert.equal(record.paymentId, null);
  assert.equal(record.paidAt, null);
  assert.equal(record.rejectedAttempts, 0);
});

test('the record is the same twice for the same input', () => {
  assert.deepEqual(orderRecord(BASE), orderRecord(BASE));
});

test('an unknown amount is refused rather than recorded as zero', () => {
  assert.throws(() => orderRecord({ ...BASE, amount: undefined }), /finite amount/);
  assert.throws(() => orderRecord({ ...BASE, amount: Number.NaN }), /finite amount/);
  // A genuinely free order is expressible; only unknown is refused.
  assert.equal(orderRecord({ ...BASE, amount: 0 }).amount, 0);
});

test('an order with no id, package or currency is refused', () => {
  assert.throws(() => orderRecord({ ...BASE, orderId: '' }), /orderId/);
  assert.throws(() => orderRecord({ ...BASE, packageId: '' }), /packageId/);
  assert.throws(() => orderRecord({ ...BASE, currency: '' }), /currency/);
});

test('a verified payment marks the order paid', async () => {
  const db = fakeDb();
  await saveOrder(db, orderRecord(BASE));

  const result = await markOrderPaid(db, {
    orderId: 'order_A1',
    paymentId: 'pay_1',
    paidAt: '2026-01-01T00:05:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, 'marked_paid');
  assert.equal(db.read('order_A1').status, ORDER_PAID);
  assert.equal(db.read('order_A1').paymentId, 'pay_1');
});

test('the amount recorded at creation is not changed by payment', async () => {
  const db = fakeDb();
  await saveOrder(db, orderRecord(BASE));
  await markOrderPaid(db, { orderId: 'order_A1', paymentId: 'pay_1' });
  assert.equal(db.read('order_A1').amount, 9900);
});

test('a verification for an order we never created is refused, not created', async () => {
  const db = fakeDb();

  const result = await markOrderPaid(db, { orderId: 'order_ghost', paymentId: 'pay_1' });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unknown_order');
  // The important half: nothing was written.
  assert.equal(db.has('order_ghost'), false);
  assert.equal(db.writes, 0);
});

test('the same payment arriving twice is a retry, not a second charge', async () => {
  const db = fakeDb();
  await saveOrder(db, orderRecord(BASE));
  await markOrderPaid(db, { orderId: 'order_A1', paymentId: 'pay_1' });

  const again = await markOrderPaid(db, { orderId: 'order_A1', paymentId: 'pay_1' });

  assert.equal(again.ok, true);
  assert.equal(again.reason, 'already_paid');
});

test('a different payment against a paid order is refused and changes nothing', async () => {
  const db = fakeDb();
  await saveOrder(db, orderRecord(BASE));
  await markOrderPaid(db, { orderId: 'order_A1', paymentId: 'pay_1' });
  const writesBefore = db.writes;

  const result = await markOrderPaid(db, { orderId: 'order_A1', paymentId: 'pay_2' });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'already_paid_with_different_payment');
  assert.equal(db.read('order_A1').paymentId, 'pay_1');
  assert.equal(db.writes, writesBefore);
});

test('a rejected signature never moves an order towards paid', async () => {
  const db = fakeDb();
  await saveOrder(db, orderRecord(BASE));

  await recordVerificationRejection(db, { orderId: 'order_A1', paymentId: 'pay_bad' });

  const stored = db.read('order_A1');
  assert.equal(stored.status, ORDER_CREATED);
  assert.equal(stored.paymentId, null);
  assert.equal(stored.rejectedAttempts, 1);
  assert.equal(stored.lastRejectedPaymentId, 'pay_bad');
});

test('rejections accumulate rather than overwrite', async () => {
  const db = fakeDb();
  await saveOrder(db, orderRecord(BASE));

  await recordVerificationRejection(db, { orderId: 'order_A1', paymentId: 'a' });
  await recordVerificationRejection(db, { orderId: 'order_A1', paymentId: 'b' });
  const third = await recordVerificationRejection(db, { orderId: 'order_A1', paymentId: 'c' });

  assert.equal(third.attempts, 3);
  assert.equal(db.read('order_A1').rejectedAttempts, 3);
});

test('a rejection against an unknown order writes nothing', async () => {
  const db = fakeDb();

  const result = await recordVerificationRejection(db, { orderId: 'order_ghost' });

  assert.equal(result.recorded, false);
  assert.equal(result.reason, 'unknown_order');
  assert.equal(db.writes, 0);
});

test('a paid order keeps its paid status when a later signature fails', async () => {
  const db = fakeDb();
  await saveOrder(db, orderRecord(BASE));
  await markOrderPaid(db, { orderId: 'order_A1', paymentId: 'pay_1' });

  await recordVerificationRejection(db, { orderId: 'order_A1', paymentId: 'pay_bad' });

  assert.equal(db.read('order_A1').status, ORDER_PAID);
  assert.equal(db.read('order_A1').paymentId, 'pay_1');
});
