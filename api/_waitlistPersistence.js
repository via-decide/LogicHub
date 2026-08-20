import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Waitlist persistence uses the root application's declared Firebase runtime.
 * Keeping it separate from the legacy sovereign adapter prevents this public
 * endpoint from loading that adapter's optional SQLite implementation.
 */
export function getWaitlistDb() {
  const app = getApps()[0] ?? initializeApp();
  return getFirestore(app);
}

export async function logWaitlistEvent(type, payload = {}) {
  await getWaitlistDb().collection('runtime_logs').add({
    type,
    payload,
    createdAt: new Date().toISOString(),
  });
}
