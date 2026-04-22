import admin from "firebase-admin";
import { getAdminDb } from "./_firebaseAdmin.js";

const APPS_COLLECTION = "apps";
const DEFAULT_ICON = "✨";
const DEFAULT_DESCRIPTION = "No description provided yet.";

export function withAppDefaults(app = {}) {
  const appName = String(app.app_name || app.name || app.title || "Untitled app").trim();
  const description = String(app.description || app.desc || DEFAULT_DESCRIPTION).trim();
  const launchUrl = String(app.launch_url || app.entry_url || app.url || "").trim();

  return {
    viewCount: 0,
    install_count: 0,
    isPublished: false,
    ...app,
    app_name: appName,
    name: appName,
    description: description || DEFAULT_DESCRIPTION,
    icon: String(app.icon || DEFAULT_ICON).trim() || DEFAULT_ICON,
    creator: String(app.creator || app.author || app.creator_id || "unknown").trim(),
    launch_url: launchUrl,
    viewCount: Number.isFinite(Number(app.viewCount)) ? Number(app.viewCount) : 0,
    install_count: Number.isFinite(Number(app.install_count)) ? Number(app.install_count) : 0,
    isPublished: app.isPublished === true
  };
}

export async function createOrUpdateApp(appId, appData = {}) {
  const db = getAdminDb();
  const payload = {
    ...withAppDefaults(appData),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection(APPS_COLLECTION).doc(appId).set(payload, { merge: true });
  return payload;
}

export async function incrementAppViewCount(appId) {
  const db = getAdminDb();
  const appRef = db.collection(APPS_COLLECTION).doc(appId);

  await appRef.set(
    {
      viewCount: admin.firestore.FieldValue.increment(1),
      isPublished: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}
