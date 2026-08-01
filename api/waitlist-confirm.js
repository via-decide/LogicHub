// LogicHub/api/waitlist-confirm.js
// The second half of the waiting-list double opt-in.
//
// This is reached by clicking a link in an email, so it answers GET and returns
// a page rather than JSON. It flips `confirmed` on exactly one entry, and only
// when the token in the link matches the one derived from that address.
//
// It never creates an entry. A confirmation for an address that never signed up
// is refused — otherwise the link would be a way to add people, which is the
// thing it exists to prevent.
// Postgres-backed getAdminDb (not _sovereignAuth.js's SQLite-backed one) --
// must read the SAME store waitlist.js writes to, see api/_pg.js's header.
import { logRuntimeEvent } from './_sovereignAuth.js';
import { getAdminDb } from './_pg.js';
import { normaliseEmail, tokenMatches, tokenSecret } from './_waitlist.js';

const COLLECTION = 'cartridge_waitlist';
const CONTACT = 'dharam@viadecide.com';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const email = normaliseEmail(req.query?.email ?? req.body?.email);
  const token = String(req.query?.token ?? req.body?.token ?? '').trim();

  const secret = tokenSecret();
  if (!secret) {
    // No secret means no link we issued can be checked. Confirming anyway would
    // accept any token at all.
    console.error('Waitlist confirmation attempted with no signing secret configured.');
    return page(res, 503, 'Confirmation is unavailable',
      `We cannot verify this link right now. Please email ${CONTACT} and we will confirm you by hand.`);
  }

  if (!email || !token) {
    return page(res, 400, 'That link is incomplete',
      'The confirmation link is missing part of itself. Try copying the whole link from the email.');
  }

  if (!tokenMatches(email, token, secret)) {
    console.warn('Waitlist confirmation with a token that does not match', { email });
    return page(res, 400, 'That link is not valid',
      `We could not verify this confirmation link. Please email ${CONTACT} if you want to be on the list.`);
  }

  let alreadyConfirmed = false;
  try {
    const ref = getAdminDb().collection(COLLECTION).doc(email);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      // A valid signature for an address that never signed up. Refused rather
      // than created.
      return page(res, 404, 'Nothing to confirm',
        'We have no waiting-list entry for that address. If you meant to join, sign up again.');
    }

    alreadyConfirmed = snapshot.data()?.confirmed === true;
    if (!alreadyConfirmed) {
      await ref.set({ confirmed: true, confirmedAt: new Date().toISOString() }, { merge: true });
    }
  } catch (error) {
    console.error('Waitlist confirmation write failed:', error);
    return page(res, 503, 'Could not confirm just now',
      `Something went wrong on our side. Try the link again, or email ${CONTACT}.`);
  }

  await logRuntimeEvent('waitlist_confirmed', { alreadyConfirmed }).catch(() => {});

  return page(res, 200, 'You are on the list',
    alreadyConfirmed
      ? 'You were already confirmed. Nothing has changed and you are still on the list.'
      : 'Confirmed. We will email you when the 8 MB cartridge is real — no payment has been '
        + 'taken and no date has been promised.');
}

/** A plain page, because a person clicked a link and is reading the result. */
function page(res, status, heading, body) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(heading)} • LogicHub</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #07110f; color: #e8f0ee; padding: 2rem;
         font: 16px/1.6 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  main { max-width: 32rem; }
  h1 { font-size: 1.5rem; margin: 0 0 1rem; color: #ff671f; }
  a { color: #ff671f; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(body)}</p>
  <p><a href="/">Back to LogicHub</a></p>
</main>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(html);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
