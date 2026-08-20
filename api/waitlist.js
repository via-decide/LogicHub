// LogicHub/api/waitlist.js
// Records interest in the storage cartridge while payments are switched off.
//
// This takes no money and promises no date. It records that someone wants to be
// told when the cartridge is available, and tells them we have it.
import { getAdminDb, logRuntimeEvent } from './_firebaseAdmin.js';
import { applyCors } from './_payments-config.js';

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

  const email = String(req.body?.email || '').trim().toLowerCase();
  const note = String(req.body?.note || '').trim().slice(0, 500);
  const country = String(req.headers['x-vercel-ip-country'] || '').slice(0, 2);

  if (!EMAIL_SHAPE.test(email)) {
    return res.status(400).json({ error: 'invalid_email', message: 'Enter a valid email address.' });
  }

  const entry = {
    email,
    note,
    country,
    product: 'storage-cartridge-8mb',
    // Recorded as indicative because pricing is not fixed. Storing it as a
    // settled figure would turn a provisional number into a commitment.
    indicativePriceUsd: 20,
    priceIsIndicative: true,
    createdAt: new Date().toISOString(),
  };

  try {
    const db = getAdminDb();
    // The email is the document id, so signing up twice updates one row rather
    // than inflating the list with duplicates.
    await db.collection(COLLECTION).doc(email).set(entry, { merge: true });
  } catch (error) {
    console.error('Waitlist write failed:', error);
    return res.status(503).json({
      error: 'waitlist_unavailable',
      message: `Could not record that just now. Please email ${NOTIFY_TO} instead.`,
    });
  }

  // Notification is best effort: the entry is already saved, so a mail failure
  // must not tell the person their signup did not work.
  const notified = await notify(entry).catch(() => false);

  await logRuntimeEvent('waitlist_signup', { product: entry.product, country, notified })
    .catch(() => {});

  return res.status(200).json({
    recorded: true,
    message: 'You are on the list. We will email you when there is something real to say.',
  });
}

async function notify(entry) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || '').trim();
  if (!apiKey || !from) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [NOTIFY_TO],
      subject: `Cartridge waiting list • ${entry.email}`,
      text: [
        'A new waiting-list entry for the 8 MB storage cartridge.',
        '',
        `Email: ${entry.email}`,
        `Country: ${entry.country || 'unknown'}`,
        `Note: ${entry.note || '(none)'}`,
        `Recorded: ${entry.createdAt}`,
      ].join('\n'),
    }),
  });

  return response.ok;
}
