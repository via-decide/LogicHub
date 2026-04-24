import { Filter } from "firebase-admin/firestore";
import { getAdminDb, jsonError, logRuntimeEvent } from "./_firebaseAdmin.js";
import { withAppDefaults } from "./_appAnalytics.js";

const ALLOWED_ORIGIN = "https://daxini.space";
const GRID_SIZE = 8;

const SAMPLE_APPS = [
  { id: "sample-notes", name: "Quick Notes", author: "Daxini Team", icon: "📝", description: "Capture and organize lightweight notes.", launch_url: "https://daxini.space/samples/quick-notes", category: "productivity", installs: 0 },
  { id: "sample-kanban", name: "Mini Kanban", author: "Daxini Team", icon: "📌", description: "Simple kanban board for tasks.", launch_url: "https://daxini.space/samples/mini-kanban", category: "workflow", installs: 0 }
];

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

function fallbackText(value, fallback) {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function toPublicApp(doc) {
  const data = withAppDefaults(doc.data() || {});
  return {
    id: doc.id,
    app_id: fallbackText(data.app_id || doc.id, doc.id),
    app_name: fallbackText(data.name || data.title, "Untitled App"),
    icon: fallbackText(data.icon, "✨"),
    description: fallbackText(data.description, "No description provided yet."),
    creator: fallbackText(data.creator || data.author || data.creator_id, "anonymous"),
    launch_url: fallbackText(data.entry_url || data.entryUrl || data.launch_url, "about:blank"),
    category: fallbackText(data.category || (Array.isArray(data.tags) && data.tags[0]) || "general", "general"),
    installs: Number(data.installs || 0),
    remixes: Number(data.remixes || 0),
    ratings: Number(data.ratings || 0),
    viewCount: Number(data.viewCount || 0)
  };
}

function scoreApp(app) {
  return (Number(app.installs) * 2) + Number(app.viewCount || 0);
}

function pickRelatedApps(allApps, lastOpenedAppId, maxSlots) {
  if (!lastOpenedAppId) return [];
  const base = allApps.find((app) => app.app_id === lastOpenedAppId || app.id === lastOpenedAppId);
  if (!base) return [];

  const related = allApps
    .filter((candidate) => candidate.app_id !== base.app_id)
    .map((candidate) => {
      const sameCreator = candidate.creator === base.creator ? 6 : 0;
      const sameCategory = candidate.category === base.category ? 4 : 0;
      const installDistance = Math.abs(Number(candidate.installs || 0) - Number(base.installs || 0));
      const similarInstalls = Math.max(0, 3 - Math.min(3, Math.floor(installDistance / 10)));
      return { candidate, rank: sameCreator + sameCategory + similarInstalls };
    })
    .filter((item) => item.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, maxSlots)
    .map((item) => item.candidate);

  return related;
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
          Filter.where("viewCount", ">=", 1),
          Filter.where("isPublished", "==", true)
        )
      )
      .limit(120)
      .get();

    const apps = snap.docs.map(toPublicApp).sort((a, b) => scoreApp(b) - scoreApp(a));
    const seedGrid = apps.slice(0, GRID_SIZE);
    const lastOpenedAppId = String(req.query?.last_opened_app || "").trim();
    const replacements = pickRelatedApps(apps, lastOpenedAppId, 3);
    const roomGrid = [...seedGrid];

    if (replacements.length) {
      [5, 6, 7].forEach((slot, idx) => {
        if (replacements[idx]) roomGrid[slot] = replacements[idx];
      });
    }

    const finalGrid = roomGrid.filter(Boolean).slice(0, GRID_SIZE);

    if (!finalGrid.length) {
      await logRuntimeEvent("grid_refresh", { source: "sample_apps", app_count: SAMPLE_APPS.length });
      return res.status(200).json({
        count: 0,
        empty: true,
        message: "No apps published yet. Create the first one in LogicHub.",
        apps: SAMPLE_APPS,
        grid: SAMPLE_APPS
      });
    }

    await logRuntimeEvent("grid_refresh", {
      source: "live_apps",
      app_count: finalGrid.length,
      last_opened_app: lastOpenedAppId || null,
      replacements: replacements.length
    });

    return res.status(200).json({
      count: finalGrid.length,
      empty: false,
      apps: finalGrid,
      grid: finalGrid
    });
  } catch (error) {
    console.error("Public feed query failed:", error);
    return jsonError(res, 500, "Failed to load public feed.", { detail: error.message });
  }
}
