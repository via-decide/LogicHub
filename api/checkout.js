// LogicHub/api/checkout.js
// Serverless function for Razorpay checkout.
//
// Payments are off unless PAYMENTS_ENABLED is explicitly 'true'. While off this
// endpoint creates no order and contacts no gateway, which is what the
// published terms currently tell users.
import Razorpay from 'razorpay';
import {
  applyCors,
  paymentsEnabled,
  paymentsDisabledResponse,
  razorpayCredentials,
} from './_payments-config.js';
// Postgres-backed, not the SQLite-backed _sovereignAuth.js getAdminDb() --
// this endpoint's write path was broken on Vercel (see api/_pg.js's header).
import { getAdminDb } from './_pg.js';
import { orderRecord, saveOrder } from './_orders.js';

const ALLOWED_COUNTRIES = ['IN', 'LU', 'JP'];

/** Amounts in the smallest currency unit, as Razorpay expects. */
const INR_AMOUNTS_PAISE = {
  founder: 171700,
  starter: 9900,
  pro: 79900,
  enterprise: 499900,
};

const SAAS_PLAN_IDS = {
  saas_pro: 'plan_ProSaaS20USD',
  saas_builder: 'plan_BuilderSaaS29USD',
};

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // Checked before anything else touches the gateway or reads a key.
  if (!paymentsEnabled()) return paymentsDisabledResponse(res);

  const { package_id: packageId } = req.body || {};
  if (!packageId || typeof packageId !== 'string') {
    return res.status(400).json({ error: 'package_id_required' });
  }

  const country = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'US';
  if (!ALLOWED_COUNTRIES.includes(country)) {
    return res.status(403).json({
      error: 'region_unavailable',
      message: 'This product is currently available only in India, Luxembourg, and Japan.',
    });
  }

  const isIndia = country === 'IN';

  if (isIndia && packageId.startsWith('saas_')) {
    return res.status(403).json({
      error: 'region_restricted',
      message: 'SaaS subscriptions are not offered in your region.',
    });
  }

  let razorpay;
  try {
    const { keyId, keySecret } = razorpayCredentials();
    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  } catch (error) {
    // A misconfiguration is ours, not the caller's, and is logged as such
    // rather than surfacing as a generic gateway failure.
    console.error('Payment configuration error:', error.message);
    return res.status(500).json({ error: 'payment_configuration_error' });
  }

  try {
    if (!isIndia && packageId.startsWith('saas_')) {
      const planId = SAAS_PLAN_IDS[packageId];
      if (!planId) return res.status(400).json({ error: 'invalid_package' });

      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        customer_notify: 1,
        total_count: 12,
      });
      return res.status(200).json({ checkout_url: subscription.short_url });
    }

    const amount = INR_AMOUNTS_PAISE[packageId];
    if (amount === undefined) {
      // No silent fallback amount. Charging a default for an unrecognised
      // package would bill someone for something nobody selected.
      return res.status(400).json({ error: 'invalid_package' });
    }

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    });

    // The amount recorded is the one from the table above, never one supplied by
    // the caller, so a later verification is checked against what we decided to
    // charge rather than what the browser says it agreed to.
    try {
      await saveOrder(
        getAdminDb(),
        orderRecord({ orderId: order.id, packageId, amount, currency: 'INR', country }),
      );
    } catch (error) {
      // An order we cannot remember is one we cannot later verify. Nothing has
      // been charged at this point, so refusing is the cheap failure.
      console.error('Order record write failed; refusing the checkout:', error);
      return res.status(503).json({
        error: 'order_not_recorded',
        message:
          'The order could not be recorded, so checkout was stopped. No charge has been made.',
      });
    }

    return res.status(200).json({ order_id: order.id, amount, currency: 'INR' });
  } catch (error) {
    console.error('Razorpay Error:', error);
    return res.status(502).json({ error: 'payment_gateway_error' });
  }
}
