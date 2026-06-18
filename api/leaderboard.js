import { getAdminDb, jsonError } from "./_sovereignAuth.js";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Ecosystem-Uid');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
