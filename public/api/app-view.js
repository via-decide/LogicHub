import { jsonError } from "./_firebaseAdmin.js";
import { incrementAppViewCount } from "./_appAnalytics.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "Method not allowed. Use POST.");
  }

  const appId = String(req.body?.appId || req.query?.appId || "").trim();
  if (!appId) {
    return jsonError(res, 400, "Missing appId.");
  }

  try {
    await incrementAppViewCount(appId);
    return res.status(200).json({ ok: true, appId });
  } catch (error) {
    console.error("Failed to increment app view count:", error);
    return jsonError(res, 500, "Failed to increment view count.", { detail: error.message });
  }
}
