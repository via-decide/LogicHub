import { jsonError } from "./_firebaseAdmin.js";
import { incrementAppViewCount } from "./_appAnalytics.js";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Ecosystem-Uid');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
