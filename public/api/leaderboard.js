import { getAdminDb, jsonError } from "./_firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return jsonError(res, 405, "Method not allowed. Use GET.");

  try {
    const db = getAdminDb();
    const appsSnap = await db.collection("apps").limit(500).get();
    const creators = {};

    appsSnap.forEach((doc) => {
      const data = doc.data() || {};
      const creatorId = String(data.creator_id || data.creatorId || "anonymous");
      if (!creators[creatorId]) creators[creatorId] = { creator_id: creatorId, creator_name: String(data.creator || creatorId), apps: 0, installs: 0, remixes: 0, ratings: 0, score: 0 };
      creators[creatorId].apps += 1;
      creators[creatorId].installs += Number(data.installs || 0);
      creators[creatorId].remixes += Number(data.remixes || 0);
      creators[creatorId].ratings += Number(data.ratings || 0);
    });

    const ranked = Object.values(creators)
      .map((entry) => ({
        ...entry,
        score: (entry.installs * 2) + (entry.remixes * 3) + (entry.ratings * 1)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return res.status(200).json({
      updated_at: new Date().toISOString(),
      creators: ranked
    });
  } catch (error) {
    return jsonError(res, 500, error.message || "Failed to load leaderboard.");
  }
}
