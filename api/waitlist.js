// LogicHub/api/waitlist.js
// Records interest in the storage cartridge while payments are switched off.
//
// This takes no money and promises no date. It records that someone wants to be
// told when the cartridge is available.
//
// An address is not a subscriber until its owner confirms. Anyone can type
// anyone's email into a form, so a raw signup is a claim about a third party,
// not consent from them. The entry is stored unconfirmed and a signed link is
// sent; only clicking it flips `confirmed`.
// Postgres-backed getAdminDb (not _sovereignAuth.js's SQLite-backed one --
// this endpoint's write path was broken on Vercel, see api/_pg.js's header).
// logRuntimeEvent stays on _sovereignAuth.js -- it's a best-effort log write,
// out of scope for this migration.
import { logRuntimeEvent } from './_sovereignAuth.js';
import { getAdminDb } from './_pg.js';
import { applyCors } from './_payments-config.js';
import {
  clientBucket,
  countRequest,
  confirmationToken,
  normaliseEmail,
  tokenSecret,
} from './_waitlist.js';

const COLLECTION = 'cartridge_waitlist';
const NOTIFY_TO = 'dharam@viadecide.com';

/** Deliberately permissive: rejecting unusual but valid addresses loses people. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const email = normaliseEmail(req.body?.email);
  const note = String(req.body?.note || '').trim().slice(0, 500);
  const country = String(req.headers['x-vercel-ip-country'] || '').slice(0, 2);

  if (!EMAIL_SHAPE.test(email)) {
    return res.status(400).json({ error: 'invalid_email', message: 'Enter a valid email address.' });
  }

  const db = getAdminDb();

  // Counted before anything is stored. A failure here refuses the signup: an
  // uncounted request through an unbounded write endpoint is the worse outcome.
  try {
    const limit = await countRequest(db, clientBucket(req));
    if (!limit.allowed) {
      return res.status(429).json({
        error: 'too_many_requests',
        message:
          'Too many signups from here in the last hour. Try again later, or email '
          + `${NOTIFY_TO} directly.`,
      });
    }
  } catch (error) {
    console.error('Rate limit check failed; refusing the signup:', error);
    return res.status(503).json({
      error: 'waitlist_unavailable',
      message: `Could not record that just now. Please email ${NOTIFY_TO} instead.`,
    });
  }

  const secret = tokenSecret();
  const entry = {
    email,
    note,
    country,
    product: 'storage-cartridge-8mb',
    // Recorded as indicative because pricing is not fixed. Storing it as a
    // settled figure would turn a provisional number into a commitment.
    indicativePriceUsd: 20,
    priceIsIndicative: true,
    // The entry exists; the consent does not yet. Nothing downstream should
    // count this address until the owner confirms it.
    confirmed: false,
    confirmedAt: null,
    createdAt: new Date().toISOString(),
  };

  try {
    // The email is the document id, so signing up twice updates one row rather
    // than inflating the list with duplicates. `confirmed` is written only by
    // the confirm endpoint, so a resubmission cannot un-confirm someone.
    const ref = db.collection(COLLECTION).doc(email);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.confirmed === true) {
      const { confirmed, confirmedAt, ...withoutConsent } = entry;
      await ref.set(withoutConsent, { merge: true });
      return res.status(200).json({
        recorded: true,
        confirmed: true,
        message: 'You are already on the list. We updated your note.',
      });
    }
    await ref.set(entry, { merge: true });
  } catch (error) {
    console.error('Waitlist write failed:', error);
    return res.status(503).json({
      error: 'waitlist_unavailable',
      message: `Could not record that just now. Please email ${NOTIFY_TO} instead.`,
    });
  }

  // Without a signing secret no confirmation link can be issued that is not
  // forgeable, so none is sent. The entry stays unconfirmed rather than being
  // quietly promoted.
  const confirmationSent = secret
    ? await sendConfirmation(entry, confirmationToken(email, secret)).catch(() => false)
    : false;

  // Best effort, and only about an entry that already exists: a mail failure
  // must not tell the person their signup did not work.
  await notify(entry, confirmationSent).catch(() => false);

  await logRuntimeEvent('waitlist_signup', {
    product: entry.product,
    country,
    confirmationSent,
  }).catch(() => {});

  return res.status(200).json({
    recorded: true,
    confirmed: false,
    confirmationSent,
    message: confirmationSent
      ? 'Almost there. Check your email and click the confirmation link — we will not '
        + 'add you to the list until you do.'
      : 'Recorded. We will confirm by email before adding you to the list.',
  });
}

function baseUrl() {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  return configured || 'https://logichub.app';
}

async function sendConfirmation(entry, token) {
  const link = `${baseUrl()}/api/waitlist-confirm?email=${encodeURIComponent(entry.email)}`
    + `&token=${encodeURIComponent(token)}`;

  return sendMail({
    to: [entry.email],
    subject: 'Confirm your place on the LogicHub cartridge waiting list',
    text: [
      'Someone — we hope you — asked to be told when the 8 MB LogicHub storage',
      'cartridge is available. Confirm that it was you:',
      '',
      link,
      '',
      'If it was not you, ignore this email. Nothing has been added to any list',
      'and we will not write to you again.',
      '',
      'No payment has been taken and no date has been promised.',
    ].join('\n'),
  });
}

async function notify(entry, confirmationSent) {
  return sendMail({
    to: [NOTIFY_TO],
    subject: `Cartridge waiting list • ${entry.email} (unconfirmed)`,
    text: [
      'A new waiting-list entry for the 8 MB storage cartridge. It is unconfirmed',
      'until the address owner clicks the confirmation link.',
      '',
      `Email: ${entry.email}`,
      `Country: ${entry.country || 'unknown'}`,
      `Note: ${entry.note || '(none)'}`,
      `Confirmation email sent: ${confirmationSent ? 'yes' : 'no'}`,
      `Recorded: ${entry.createdAt}`,
    ].join('\n'),
  });
}

async function sendMail({ to, subject, text }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || '').trim();
  if (!apiKey || !from) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text }),
  });

  return response.ok;
}
