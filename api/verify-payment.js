// LogicHub/api/verify-payment.js
// Verifies a Razorpay payment signature.
//
// A success callback from the browser is a claim, not proof. Razorpay signs
// the order and payment ids with the key secret, and only that signature shows
// the payment actually happened. Without this step an attacker can post a
// fabricated success and be treated as paid.
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  applyCors,
  paymentsEnabled,
  paymentsDisabledResponse,
  razorpayCredentials,
} from './_payments-config.js';
// Postgres-backed, not the SQLite-backed _sovereignAuth.js getAdminDb() --
// this endpoint's write path was broken on Vercel (see api/_pg.js's header).
import { getAdminDb } from './_pg.js';
import { markOrderPaid, recordVerificationRejection } from './_orders.js';

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  if (!paymentsEnabled()) return paymentsDisabledResponse(res);

  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body || {};

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      error: 'missing_fields',
      message: 'order id, payment id and signature are all required.',
    });
  }

  let keySecret;
  try {
    ({ keySecret } = razorpayCredentials());
  } catch (error) {
    console.error('Payment configuration error:', error.message);
    return res.status(500).json({ error: 'payment_configuration_error' });
  }

  const verified = signatureMatches(`${orderId}|${paymentId}`, signature, keySecret);

  if (!verified) {
    // An unverified payment is not a payment. It is never partially accepted,
    // and the order it names is left exactly as it was.
    console.warn('Rejected payment with an invalid signature', { orderId, paymentId });
    await recordVerificationRejection(getAdminDb(), { orderId, paymentId })
      .catch((error) => console.error('Could not record the rejection:', error));
    return res.status(400).json({ error: 'signature_mismatch', verified: false });
  }

  // The signature is good. Now the order has to be one we actually issued.
  let result;
  try {
    result = await markOrderPaid(getAdminDb(), { orderId, paymentId });
  } catch (error) {
    // The signature held but we could not write the outcome. Reporting success
    // here would leave a paid customer with no record that they paid.
    console.error('Order update failed after a valid signature:', error);
    return res.status(503).json({
      error: 'order_update_failed',
      verified: true,
      recorded: false,
      message:
        'The payment signature is valid but the order could not be updated. '
        + 'Do not retry the payment — contact dharam@viadecide.com with the payment id.',
      paymentId,
    });
  }

  if (!result.ok) {
    if (result.reason === 'unknown_order') {
      // A valid signature for an order this side never created means the order
      // came from somewhere else. It is refused, not adopted.
      console.warn('Verification for an order that was never created here', { orderId });
      return res.status(404).json({ error: 'unknown_order', verified: true, recorded: false });
    }

    console.warn('Second payment against an already-paid order', { orderId, paymentId });
    return res.status(409).json({
      error: result.reason,
      verified: true,
      recorded: false,
      message:
        'This order is already paid by a different payment. Nothing has been changed. '
        + 'Contact dharam@viadecide.com with both payment ids.',
    });
  }

  return res.status(200).json({
    verified: true,
    recorded: true,
    alreadyPaid: result.reason === 'already_paid',
    orderId,
    paymentId,
  });
}

/**
 * Constant-time comparison of the expected and supplied signatures.
 *
 * A plain string comparison leaks how much of the signature was correct through
 * timing, which lets an attacker discover a valid one byte by byte.
 */
function signatureMatches(payload, supplied, keySecret) {
  const expected = createHmac('sha256', keySecret).update(payload).digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const suppliedBuffer = Buffer.from(String(supplied), 'utf8');

  // timingSafeEqual throws on a length mismatch, which is itself a mismatch.
  if (expectedBuffer.length !== suppliedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}
