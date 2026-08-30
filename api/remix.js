// Remix an already-published LogicHub app: hand the client the original's
// buildable state (blocks/connections -- the visual builder's own graph,
// not just the rendered HTML) so a second creator can load it, change it,
// and publish their own version via the existing publish-app.js flow.
//
// Reuses the one real store every other endpoint here uses (getAdminDb(),
// which resolves to Postgres via _pg.js) -- no new store, per the product
// direction that logichub.app is the platform and existing infra is what
// gets reconciled, not duplicated.
//
// remix_count is counted here, at "start a remix", not at "publish the
// remix" -- same convention GitHub uses for fork counts. Deduped per
// device for 24h using the identical transactional lock pattern install.js
// already established, so repeatedly hitting this endpoint (or a client
// retry) doesn't inflate the count the way a naive increment would.
import admin, { getAdminDb, jsonError, logRuntimeEvent } from "./_sovereignAuth.js";
import { applyCors } from "./_cors.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const APPS_COLLECTION = "apps";

export default async function handler(req, res) {
  applyCors(req, res, { methods: "POST,OPTIONS" });
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return jsonError(res, 405, "Method not allowed. Use POST.");
  }

  const appId = String(req.body?.appId || "").trim();
  const deviceId = String(req.body?.device_id || "").trim();
  if (!appId || !deviceId) {
    return jsonError(res, 400, "Missing appId or device_id.");
  }

  const db = getAdminDb();
  const appRef = db.collection(APPS_COLLECTION).doc(appId);
  const remixLockRef = db.collection("appRemixLocks").doc(`${appId}__${deviceId}`);

  let sourceApp;
  let counted = false;

  try {
    await db.runTransaction(async (tx) => {
      const appSnap = await tx.get(appRef);
      if (!appSnap.exists) {
        const error = new Error("Source app not found.");
        error.statusCode = 404;
        throw error;
      }
      sourceApp = { app_id: appSnap.id, ...appSnap.data() };

      const lockSnap = await tx.get(remixLockRef);
      const lastRemixAt = lockSnap.exists ? lockSnap.data()?.last_remix_ts?.toDate?.() : null;
      const now = new Date();
      if (lastRemixAt && (now.getTime() - lastRemixAt.getTime()) < WINDOW_MS) {
        // Already counted for this device in the last 24h -- still return
        // the source app's remixable state, just don't double-count.
        return;
      }

      tx.set(remixLockRef, {
        app_id: appId,
        device_id: deviceId,
        last_remix_ts: admin.firestore.Timestamp.fromDate(now),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      tx.set(appRef, {
        remix_count: admin.firestore.FieldValue.increment(1),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      counted = true;
    });
  } catch (error) {
    console.error("Remix failed:", error);
    await logRuntimeEvent("remix_attempt_error", { appId, deviceId, message: error?.message });
    return res.status(error.statusCode || 500).json({ error: error.statusCode === 404 ? error.message : `Remix failed: ${error.message}` });
  }

  await logRuntimeEvent("remix_attempt", { appId, deviceId, counted, status: "success" });

  return res.status(200).json({
    success: true,
    remixedFrom: {
      appId: sourceApp.app_id,
      title: sourceApp.title || sourceApp.app_name || "Untitled app",
      description: sourceApp.description || "",
      icon: sourceApp.icon || "✨",
      creator: sourceApp.creator || sourceApp.creator_id || "unknown",
      slug: sourceApp.slug || ""
    },
    // The visual builder's own graph state -- what actually makes this a
    // remix (editable and re-publishable) rather than a copy of the
    // rendered output. Empty arrays for apps published before blocks/
    // connections were captured (the earlier api/publish/index.js
    // "Auto-Forge" path never stored them) -- the client falls back to
    // starting from the PRD/description in that case, same as a fresh build.
    blocks: Array.isArray(sourceApp.blocks) ? sourceApp.blocks : [],
    connections: Array.isArray(sourceApp.connections) ? sourceApp.connections : [],
    counted
  });
}
