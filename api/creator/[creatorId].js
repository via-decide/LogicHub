import { getAdminDb, jsonError, logRuntimeEvent } from "../_firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return jsonError(res, 405, "Method not allowed. Use GET.");

  try {
    const creatorId = String(req.query?.creatorId || "").trim();
    if (!creatorId) return jsonError(res, 400, "Missing creatorId.");

    const db = getAdminDb();
    const appsSnap = await db.collection("apps").where("creator_id", "==", creatorId).get();

    const apps = appsSnap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        app_id: String(data.app_id || doc.id),
        app_name: String(data.title || data.name || "Untitled app"),
        installs: Number(data.install_count || 0)
      };
    });

    const totalInstalls = apps.reduce((sum, app) => sum + app.installs, 0);
    const creatorName = String(appsSnap.docs[0]?.data()?.creator || creatorId);

    await logRuntimeEvent("creator_profile_visit", { creator_id: creatorId });
    return res.status(200).json({
      ok: true,
      creator_id: creatorId,
      creator_name: creatorName,
      total_installs: totalInstalls,
      apps
    });
  } catch (error) {
    return jsonError(res, 500, error.message || "Failed to load creator profile.");
  }
}
