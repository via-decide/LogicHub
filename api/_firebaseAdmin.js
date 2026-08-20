import admin from "firebase-admin";

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function ensureAdminApp() {
  if (admin.apps.length > 0) return admin.app();

  const projectId = env("FIREBASE_PROJECT_ID", env("GOOGLE_CLOUD_PROJECT"));
  const clientEmail = env("FIREBASE_CLIENT_EMAIL");
  const privateKey = env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, "
      + "FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
    ...(env("FIREBASE_STORAGE_BUCKET")
      ? { storageBucket: env("FIREBASE_STORAGE_BUCKET") }
      : {}),
  });
}

export function getAdminDb() {
  return ensureAdminApp().firestore();
}

export function getAdminAuth() {
  return ensureAdminApp().auth();
}

export function jsonError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({ error: message, ...extra });
}

export async function logRuntimeEvent(type, payload = {}) {
  try {
    await getAdminDb().collection("runtimeLogs").add({
      type: String(type || "event"),
      payload: payload && typeof payload === "object"
        ? payload
        : { value: String(payload || "") },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Runtime log write failed:", error);
  }
}

export default admin;
