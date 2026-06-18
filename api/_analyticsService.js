/**
 * LogicHub Analytics Service — v1
 * Workflow telemetry layer for the complete App Lifecycle funnel.
 *
 * Tracks: signup_count | project_created | apk_uploaded | zip_uploaded
 *         github_imported | publish_clicked | returning_users
 *
 * Architecture: Firestore-backed. Two writes per event:
 *   1. analyticsEvents  → immutable event log (queryable, rich metadata)
 *   2. analyticsDailyCounts → mutable daily counter per event (fast dashboard reads)
 */

import admin from "firebase-admin";
import { getAdminDb } from "./_firebaseAdmin.js";

// ─── Valid canonical event names ─────────────────────────────────────────────
export const ANALYTICS_EVENTS = Object.freeze({
  SIGNUP_COUNT:    "signup_count",
  PROJECT_CREATED: "project_created",
  APK_UPLOADED:    "apk_uploaded",
  ZIP_UPLOADED:    "zip_uploaded",
  GITHUB_IMPORTED: "github_imported",
  PUBLISH_CLICKED: "publish_clicked",
  RETURNING_USERS: "returning_users",
  ONBOARDING_STARTED: "onboarding_started",
  SCREEN_0_VIEWED: "screen_0_viewed",
  SCREEN_1_VIEWED: "screen_1_viewed",
  SCREEN_2_VIEWED: "screen_2_viewed",
  SCREEN_3_VIEWED: "screen_3_viewed",
  ONBOARDING_COMPLETED: "onboarding_completed",
});

const VALID_EVENTS = new Set(Object.values(ANALYTICS_EVENTS));

/**
 * Returns the ISO date key for a daily counter doc: e.g. "2026-06-17"
 */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Core tracking function.
 * Fire-and-forget safe — errors are caught and logged, never thrown to callers.
 *
 * @param {string}  eventName  - One of ANALYTICS_EVENTS values
 * @param {object}  opts
 * @param {string}  opts.userId     - Firebase uid or ecosystem_uid
 * @param {string}  [opts.projectId]
 * @param {string}  [opts.sessionId]
 * @param {object}  [opts.metadata] - Arbitrary structured event metadata
 */
export async function trackEvent(eventName, opts = {}) {
  if (!VALID_EVENTS.has(eventName)) {
    console.warn(`[Analytics] Unknown event: ${eventName}`);
    return;
  }

  const { userId = null, projectId = null, sessionId = null, metadata = {} } = opts;
  const dateKey = todayKey();

  try {
    const db = getAdminDb();
    const batch = db.batch();

    // 1. Immutable event log entry
    const eventRef = db.collection("analyticsEvents").doc();
    batch.set(eventRef, {
      event_name:    eventName,
      user_id:       userId,
      project_id:    projectId,
      session_id:    sessionId,
      metadata_json: metadata && typeof metadata === "object" ? metadata : {},
      date_key:      dateKey,
      created_at:    admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Daily counter increment — doc ID: "2026-06-17"
    //    Sub-document per event keeps all counters in one readable doc.
    const dailyRef = db.collection("analyticsDailyCounts").doc(dateKey);
    batch.set(
      dailyRef,
      {
        [eventName]:   admin.firestore.FieldValue.increment(1),
        date_key:      dateKey,
        last_updated:  admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
  } catch (err) {
    // Never surface analytics failures to the product flow
    console.error(`[Analytics] trackEvent failed for "${eventName}":`, err.message);
  }
}

/**
 * Returning-user check helper.
 * Reads the user's last_seen_at from Firestore users collection.
 * If the gap is > 24 h, emits a returning_users event AND updates last_seen_at.
 *
 * @param {string} userId
 */
export async function trackReturningUser(userId) {
  if (!userId) return;
  try {
    const db  = getAdminDb();
    const ref = db.collection("users").doc(userId);
    const doc = await ref.get();
    const data = doc.exists ? doc.data() : {};

    const lastSeen = data?.last_seen_at?.toDate?.() || null;
    const now      = new Date();
    const msIn24h  = 24 * 60 * 60 * 1000;

    const isReturning = !lastSeen || (now - lastSeen) > msIn24h;

    if (isReturning) {
      await trackEvent(ANALYTICS_EVENTS.RETURNING_USERS, { userId });
    }

    // Always update last_seen_at so the next visit is measured accurately
    await ref.set(
      { last_seen_at: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.error("[Analytics] trackReturningUser failed:", err.message);
  }
}
