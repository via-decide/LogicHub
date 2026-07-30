// LogicHub/api/_payments-config.js
// Shared configuration and guards for the payment endpoints.

/**
 * Payments are off unless this is explicitly set to 'true'.
 *
 * The default is off on purpose. A live Razorpay key used to sit in this
 * codebase as a hardcoded fallback, which meant a deploy could take real money
 * without anyone deciding that it should. Switching payments on is now a
 * deliberate act, recorded in the environment.
 */
export function paymentsEnabled() {
  return String(process.env.PAYMENTS_ENABLED || '').toLowerCase() === 'true';
}

/**
 * Razorpay credentials, or a clear failure.
 *
 * There is no fallback for either value. An empty secret used to be substituted
 * silently, which turned a missing environment variable into a confusing error
 * at a customer's checkout rather than an obvious one at startup.
 */
export function razorpayCredentials() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();

  const missing = [];
  if (!keyId) missing.push('RAZORPAY_KEY_ID');
  if (!keySecret) missing.push('RAZORPAY_KEY_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `Payments are enabled but ${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set.`,
    );
  }

  return { keyId, keySecret };
}

/**
 * Origins allowed to call the payment endpoints.
 *
 * A wildcard origin cannot be combined with credentialed requests — browsers
 * reject that pair outright — so the allowlist is explicit. Additional origins
 * can be supplied as a comma-separated PAYMENTS_ALLOWED_ORIGINS.
 */
const DEFAULT_ORIGINS = [
  'https://logichub.app',
  'https://www.logichub.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

export function allowedOrigins() {
  const extra = String(process.env.PAYMENTS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ORIGINS, ...extra])];
}

/**
 * Apply CORS for a request, echoing the origin only when it is allowed.
 * Returns false when the origin is not permitted, so the caller can stop.
 */
export function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = allowedOrigins();

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Requests without an Origin header are not browser cross-origin calls
  // (server-to-server, curl); they are allowed through without CORS headers.
  if (!origin) return true;

  if (!allowed.includes(origin)) return false;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  return true;
}

/**
 * The response sent while payments are switched off.
 *
 * It says plainly that nothing is being charged, which matches what the
 * published terms tell users, rather than failing in a way that looks like an
 * outage.
 */
export function paymentsDisabledResponse(res) {
  return res.status(503).json({
    error: 'payments_disabled',
    message:
      'Payments are not enabled on this deployment. No charge has been made and no '
      + 'order has been created. Join the waiting list to be told when they open.',
    waitlist: '/waitlist',
  });
}
