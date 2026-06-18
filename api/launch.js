import admin from "firebase-admin";
import { getAdminDb, jsonError, logRuntimeEvent } from "./_firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed. Use POST.");

  try {
    const appId = String(req.body?.app_id || "").trim();
    const deviceId = String(req.body?.device_id || "").trim();
    const ts = String(req.body?.timestamp || "").trim();
    const deviceType = String(req.body?.device_type || "unknown").trim().toLowerCase();

    if (!appId || !deviceId || !ts) return jsonError(res, 400, "Missing app_id, device_id, or timestamp.");
    const eventTs = new Date(ts);
    if (Number.isNaN(eventTs.getTime())) return jsonError(res, 400, "Invalid timestamp.");

    const db = getAdminDb();
    await db.collection("app_launches").add({
      app_id: appId,
      device_id: deviceId,
      device_type: deviceType || "unknown",
      timestamp: admin.firestore.Timestamp.fromDate(eventTs),
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    await logRuntimeEvent("app_launch", { app_id: appId, device_id: deviceId, timestamp: ts, device_type: deviceType });
    return res.status(200).json({ ok: true, app_id: appId, device_id: deviceId, timestamp: ts, device_type: deviceType || "unknown" });
  } catch (error) {
    await logRuntimeEvent("app_launch_error", { message: error?.message || "Launch event save failed." });
    return jsonError(res, 500, error.message || "Launch event save failed.");
  }
}
