// LogicHub/api/_orders.js
// Order records for the payment path.
//
// Until now an order existed only at Razorpay. The gateway created one, the
// browser was handed the id, and nothing on this side remembered that it had
// happened. That leaves no way to answer "was this order ours, and was it
// actually paid?" — which is the only question verification is for.
//
// The rules this file exists to hold:
//
//   1. An unverified payment never marks an order paid.
//   2. A verification for an order we never created is refused, not created.
//   3. The amount comes from the server's own record at creation time, so a
//      later claim cannot restate what something cost.
//
// The store functions take the database as an argument rather than reaching for
// it, so the rules above can be tested without Firestore.

/** Where order records live. */
export const ORDERS_COLLECTION = 'payment_orders';

/** The only statuses an order record holds. */
export const ORDER_CREATED = 'created';
export const ORDER_PAID = 'paid';

/**
 * The record written when an order is created.
 *
 * `createdAt` is passed in rather than read from the clock here, so a caller can
 * produce the same record twice and compare them.
 */
export function orderRecord({
  orderId,
  packageId,
  amount,
  currency,
  country = '',
  createdAt,
}) {
  if (!orderId) throw new Error('orderRecord requires an orderId.');
  if (!packageId) throw new Error('orderRecord requires a packageId.');
  if (!Number.isFinite(amount)) {
    // An unknown amount must not become zero. A zero-amount order record would
    // later read as "this was free".
    throw new Error('orderRecord requires a finite amount.');
  }
  if (!currency) throw new Error('orderRecord requires a currency.');

  return {
    orderId: String(orderId),
    packageId: String(packageId),
    amount,
    currency: String(currency),
    country: String(country).slice(0, 2),
    status: ORDER_CREATED,
    paymentId: null,
    paidAt: null,
    rejectedAttempts: 0,
    lastRejectionAt: null,
    createdAt: createdAt || new Date().toISOString(),
  };
}

/**
 * Persist a newly created order.
 *
 * Throws on failure rather than swallowing it. The caller fails the checkout,
 * because an order we cannot remember is one we cannot later verify — and at
 * that point nothing has been charged, so refusing costs the user nothing.
 */
export async function saveOrder(db, record) {
  await db.collection(ORDERS_COLLECTION).doc(record.orderId).set(record);
  return record;
}

/**
 * Mark an order paid after its signature has been verified.
 *
 * Callers must verify the signature first. This function does not check it and
 * is never a substitute for doing so.
 *
 * Returns `{ ok, reason }` rather than throwing, so the endpoint can answer
 * differently for "we never issued this order" and "this order is already paid".
 */
export async function markOrderPaid(db, { orderId, paymentId, paidAt }) {
  const ref = db.collection(ORDERS_COLLECTION).doc(String(orderId));
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    // Rule 2. Writing the record here would let anyone with a valid-looking
    // signature conjure an order that this side never issued.
    return { ok: false, reason: 'unknown_order' };
  }

  const existing = snapshot.data();

  if (existing.status === ORDER_PAID) {
    // The same payment arriving twice is a retry, not a problem.
    if (existing.paymentId === String(paymentId)) {
      return { ok: true, reason: 'already_paid', order: existing };
    }
    // A second, different payment against a paid order is not accepted
    // silently. It is either a duplicate charge or an attempt to reuse an
    // order, and both need a human to look.
    return { ok: false, reason: 'already_paid_with_different_payment', order: existing };
  }

  const update = {
    status: ORDER_PAID,
    paymentId: String(paymentId),
    paidAt: paidAt || new Date().toISOString(),
  };
  await ref.set(update, { merge: true });

  return { ok: true, reason: 'marked_paid', order: { ...existing, ...update } };
}

/**
 * Record that a verification attempt failed its signature check.
 *
 * The attempt is counted on the order, and the order's status is left exactly
 * as it was. A rejected verification is not a state an order moves into — it is
 * something that happened to an order that is still unpaid, or still paid.
 */
export async function recordVerificationRejection(db, { orderId, paymentId, rejectedAt }) {
  const ref = db.collection(ORDERS_COLLECTION).doc(String(orderId));
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return { recorded: false, reason: 'unknown_order' };
  }

  const existing = snapshot.data();
  const attempts = Number.isFinite(existing.rejectedAttempts) ? existing.rejectedAttempts : 0;

  await ref.set(
    {
      rejectedAttempts: attempts + 1,
      lastRejectionAt: rejectedAt || new Date().toISOString(),
      lastRejectedPaymentId: paymentId ? String(paymentId) : null,
    },
    { merge: true },
  );

  return { recorded: true, reason: 'rejection_recorded', attempts: attempts + 1 };
}
