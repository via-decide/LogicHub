import admin from "firebase-admin";
import { getAdminDb } from "./_firebaseAdmin.js";

const APPS_COLLECTION = "apps";

export function withAppDefaults(app = {}) {
  return {
    viewCount: 0,
    isPublished: false,
    ...app,
    viewCount: Number.isFinite(Number(app.viewCount)) ? Number(app.viewCount) : 0,
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
