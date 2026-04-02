import { Filter } from "firebase-admin/firestore";
import { getAdminDb, jsonError } from "./_firebaseAdmin.js";
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
    id: doc.id,
    name: String(data.name || "").trim(),
    author: String(data.author || "").trim(),
    icon: String(data.icon || "✨").trim() || "✨"
  };
}

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
      .get();

    const apps = snap.docs.map(toPublicApp);

    return res.status(200).json({
      count: apps.length,
      apps
    });
  } catch (error) {
    console.error("Public feed query failed:", error);
    return jsonError(res, 500, "Failed to load public feed.", { detail: error.message });
  }
}
