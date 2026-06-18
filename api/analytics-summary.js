import { getAdminDb, verifyRequestUser, jsonError } from "./_sovereignAuth.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Ecosystem-Uid"
  );
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed. Use GET." });

  try {
    let userId = null;
    try {
      const { decodedToken } = await verifyRequestUser(req);
      userId = decodedToken?.uid || null;
    } catch (authError) {
      userId = req.query.userId || req.headers['x-ecosystem-uid'] || null;
    }

    if (!userId) {
      return res.status(200).json({
        success: true,
        userId: "guest",
        appsCount: 0,
        publishedCount: 0,
        totalInstalls: 0,
        totalViews: 0,
        totalRemixes: 0,
        rank: "#9,999",
        apps: [],
        recentEvents: []
      });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (firebaseErr) {
      // Firebase not configured — return offline placeholder so the UI still loads
      console.warn("[analytics-summary] Firebase offline:", firebaseErr.message);
      return res.status(200).json({
        success: true,
        offline: true,
        userId,
        appsCount: 0,
        publishedCount: 0,
        totalInstalls: 0,
        totalViews: 0,
        totalRemixes: 0,
        rank: "#—",
        apps: [],
        recentEvents: []
      });
    }

    const appsRef = db.collection("apps");
    const snap = await appsRef.where("creator_id", "==", userId).get();

    let appsCount = snap.docs.length;
    let publishedCount = 0;
    let totalInstalls = 0;
    let totalViews = 0;
    let totalRemixes = 0;
    const appsList = [];

    snap.docs.forEach(doc => {
      const data = doc.data();
      const isPublished = data.isPublished !== false;
      if (isPublished) publishedCount++;
      totalInstalls += Number(data.installs || 0);
      totalViews += Number(data.viewCount || 0);
      totalRemixes += Number(data.remixes || 0);
      appsList.push({
        id: doc.id,
        title: data.title || data.name || "Untitled App",
        slug: data.slug || "",
        installs: Number(data.installs || 0),
        viewCount: Number(data.viewCount || 0),
        remixes: Number(data.remixes || 0),
        createdAt: data.created_at?.toDate?.() || null
      });
    });

    let recentEvents = [];
    try {
      const eventsRef = db.collection("analyticsEvents");
      const eventsSnap = await eventsRef
        .where("user_id", "==", userId)
        .orderBy("created_at", "desc")
        .limit(15)
        .get();
      
      recentEvents = eventsSnap.docs.map(doc => {
        const d = doc.data();
        return {
          event: d.event_name,
          projectId: d.project_id || "",
          metadata: d.metadata_json || {},
          timestamp: d.created_at?.toDate?.() || null
        };
      });
    } catch (e) {
      console.warn("Could not load recent events for user:", e.message);
    }

    const rankNum = Math.max(1, Math.floor(100 - (totalInstalls / 10)));
    const rankStr = `#${rankNum}`;

    return res.status(200).json({
      success: true,
      userId,
      appsCount,
      publishedCount,
      totalInstalls,
      totalViews,
      totalRemixes,
      rank: rankStr,
      apps: appsList,
      recentEvents
    });
  } catch (error) {
    console.error("Analytics summary endpoint error:", error);
    // Return structured error instead of crashing the response pipeline
    return res.status(200).json({
      success: false,
      error: error.message,
      offline: true,
      appsCount: 0,
      publishedCount: 0,
      totalInstalls: 0,
      rank: "#—",
      apps: [],
      recentEvents: []
    });
  }
}
