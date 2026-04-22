import admin from "firebase-admin";
import { getAdminDb, jsonError, logRuntimeEvent } from "./_firebaseAdmin.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed. Use POST.");

  try {
    const appId = String(req.body?.app_id || "").trim();
    const deviceId = String(req.body?.device_id || "").trim();
    const ts = String(req.body?.timestamp || "").trim();
    if (!appId || !deviceId || !ts) return jsonError(res, 400, "Missing app_id, device_id, or timestamp.");

    const eventTs = new Date(ts);
    if (Number.isNaN(eventTs.getTime())) return jsonError(res, 400, "Invalid timestamp.");

    const db = getAdminDb();
    const lockId = `${appId}__${deviceId}`;
    const installLockRef = db.collection("appInstallLocks").doc(lockId);
    const installRef = db.collection("app_installs").doc();
    const appRef = db.collection("apps").doc(appId);

    await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(installLockRef);
      const lastInstallAt = lockSnap.exists ? lockSnap.data()?.last_install_ts?.toDate?.() : null;
      if (lastInstallAt && (eventTs.getTime() - lastInstallAt.getTime()) < WINDOW_MS) {
        const err = new Error("Install already tracked for this device in the last 24h.");
        err.statusCode = 429;
        throw err;
      }

      tx.set(installLockRef, {
        app_id: appId,
        device_id: deviceId,
        last_install_ts: admin.firestore.Timestamp.fromDate(eventTs),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      tx.set(installRef, {
        app_id: appId,
        device_id: deviceId,
        timestamp: admin.firestore.Timestamp.fromDate(eventTs),
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      tx.set(appRef, {
        app_id: appId,
        installs: admin.firestore.FieldValue.increment(1),
        last_install_at: admin.firestore.Timestamp.fromDate(eventTs),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    await logRuntimeEvent("install_event", { app_id: appId, device_id: deviceId, timestamp: ts });
    return res.status(200).json({ ok: true, app_id: appId, device_id: deviceId, timestamp: ts });
  } catch (error) {
    await logRuntimeEvent("install_event_error", { app_id: req.body?.app_id || "", device_id: req.body?.device_id || "", message: error?.message || "Install save failed." });
    return jsonError(res, error.statusCode || 500, error.message || "Install save failed.");
  }
}
