import { Filter } from "firebase-admin/firestore";
import { getAdminDb, jsonError, logRuntimeEvent } from "./_firebaseAdmin.js";
import { withAppDefaults } from "./_appAnalytics.js";

const ALLOWED_ORIGIN = "https://daxini.space";

function setPublicFeedHeaders(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self' https://daxini.space");

  if (req.headers?.origin && req.headers.origin !== ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", "null");
  }
}

function toPublicApp(doc) {
  const data = withAppDefaults(doc.data() || {});
  return {
    app_id: doc.id,
    app_name: String(data.app_name || "Untitled app").trim(),
    creator: String(data.creator || "unknown").trim(),
    icon: String(data.icon || "✨").trim() || "✨",
    description: String(data.description || "No description provided yet.").trim(),
    launch_url: String(data.launch_url || "").trim(),
    installs: Number(data.install_count || 0),
    category: String(data.category || "general").trim()
  };
}

const SAMPLE_APPS = [
  { app_id: "sample-1", app_name: "Focus Sprint", creator: "Daxini Team", icon: "🚀", description: "Sample productivity app.", launch_url: "", installs: 0, category: "productivity" }
];

export default async function handler(req, res) {
  setPublicFeedHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return jsonError(res, 405, "Method not allowed. Use GET.");
  }

  try {
    const db = getAdminDb();
    const appsRef = db.collection("apps");

    const snap = await appsRef
      .where(
        Filter.or(
          Filter.where("viewCount", ">=", 10),
          Filter.where("isPublished", "==", true)
        )
      )
      .limit(80)
      .get();

    const apps = snap.docs.map(toPublicApp).filter((app) => app.app_name && app.creator && app.launch_url);
    const payloadApps = apps.length ? apps : SAMPLE_APPS;

    await logRuntimeEvent("grid_refresh", { count: payloadApps.length, used_sample: apps.length === 0 });
    return res.status(200).json({
      count: payloadApps.length,
      used_sample: apps.length === 0,
      apps: payloadApps
    });
  } catch (error) {
    console.error("Public feed query failed:", error);
    return jsonError(res, 500, "Failed to load public feed.", { detail: error.message });
  }
}
