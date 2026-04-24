import { getAdminDb, jsonError, logRuntimeEvent } from "../_firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return jsonError(res, 405, "Method not allowed. Use GET.");

  const creatorId = String(req.query?.creator_id || "").trim();
  if (!creatorId) return jsonError(res, 400, "Missing creator_id.");

  try {
    const db = getAdminDb();
    const appsSnap = await db.collection("apps").where("creator_id", "==", creatorId).limit(200).get();

    const apps = appsSnap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        app_id: String(data.app_id || doc.id),
        app_name: String(data.title || data.name || "Untitled App"),
        installs: Number(data.installs || 0)
      };
    });

    const totalInstalls = apps.reduce((sum, app) => sum + Number(app.installs || 0), 0);
    const creatorName = appsSnap.docs[0]?.data()?.creator || creatorId;
    await logRuntimeEvent("creator_profile_visit", { creator_id: creatorId, apps: apps.length, installs: totalInstalls });

    return res.status(200).json({
      creator_id: creatorId,
      creator_name: creatorName,
      apps_published: apps.length,
      total_installs: totalInstalls,
      apps
    });
  } catch (error) {
    return jsonError(res, 500, error.message || "Failed to load creator profile.");
  }
}
