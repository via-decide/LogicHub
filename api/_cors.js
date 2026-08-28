// Shared CORS handling for endpoints that need to accept cross-origin
// requests from this product's own front ends.
//
// Every one of these endpoints used to echo `Access-Control-Allow-Origin: *`
// directly, which — combined with `Access-Control-Allow-Credentials` on a
// few of them — is not just permissive but browser-invalid (a wildcard
// origin can't carry credentials at all, so those requests were silently
// failing in exactly the case they were trying to support). Echoing back
// only an allowlisted origin, the same pattern `publish-image/index.js`
// already uses, fixes both problems at once.
const ALLOWED_ORIGINS = new Set([
  'https://logichub.app',
  'https://www.logichub.app',
  'https://daxini.space',
  'https://www.daxini.space',
  'http://localhost:3000',
  'http://localhost:3001',
]);

const DEFAULT_HEADERS =
  'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, '
  + 'Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Ecosystem-Uid';

export function applyCors(req, res, options = {}) {
  const { methods = 'GET,OPTIONS', headers = DEFAULT_HEADERS, credentials = false } = options;
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (credentials) res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
  res.setHeader('Vary', 'Origin');
}
