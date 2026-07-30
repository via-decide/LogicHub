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
    // An unverified payment is not a payment. It is never partially accepted.
    console.warn('Rejected payment with an invalid signature', { orderId, paymentId });
    return res.status(400).json({ error: 'signature_mismatch', verified: false });
  }

  return res.status(200).json({ verified: true, orderId, paymentId });
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
