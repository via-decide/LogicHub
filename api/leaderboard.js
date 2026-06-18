import { getAdminDb, jsonError } from "./_firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return jsonError(res, 405, "Method not allowed. Use GET.");

  try {
    const db = getAdminDb();
    const appsSnap = await db.collection("apps").limit(500).get();
    const byCreator = new Map();

    appsSnap.forEach((doc) => {
      const data = doc.data() || {};
      const creatorId = String(data.creator_id || "unknown");
      const creatorName = String(data.creator || creatorId);
      const installs = Number(data.install_count || 0);
      const remixes = Number(data.remix_count || 0);
      const ratings = Number(data.rating_count || 0);

      if (!byCreator.has(creatorId)) {
        byCreator.set(creatorId, { creator_id: creatorId, creator: creatorName, apps: 0, installs: 0, remixes: 0, ratings: 0 });
      }
      const row = byCreator.get(creatorId);
      row.apps += 1;
      row.installs += installs;
      row.remixes += remixes;
      row.ratings += ratings;
      row.score = (row.installs * 2) + (row.remixes * 3) + row.ratings;
    });

    const topCreators = Array.from(byCreator.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10);

    return res.status(200).json({ ok: true, updated_at: new Date().toISOString(), top_creators: topCreators });
  } catch (error) {
    return jsonError(res, 500, error.message || "Failed to build leaderboard.");
  }
}
