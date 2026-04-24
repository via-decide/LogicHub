import admin from "firebase-admin";

function getEnv(name, fallback = "") {
  return String(process.env[name] || fallback || "").trim();
}

function getPrivateKey() {
  const raw = getEnv("FIREBASE_PRIVATE_KEY");
  return raw ? raw.replace(/\\n/g, "\n") : "";
}

function getProjectId() {
  return getEnv("FIREBASE_PROJECT_ID", getEnv("GOOGLE_CLOUD_PROJECT", "logichub-app"));
}

function ensureAdminApp() {
  if (admin.apps.length) return admin.app();

  const projectId = getProjectId();
  const clientEmail = getEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = getPrivateKey();
  const storageBucket = getEnv("FIREBASE_STORAGE_BUCKET", "logichub-app.firebasestorage.app");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    }),
    projectId,
    storageBucket
  });
}

export function getAdminAuth() {
  return ensureAdminApp().auth();
}

export function getAdminDb() {
  return ensureAdminApp().firestore();
}

export function getBearerToken(req) {
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || "");
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return String(req.body?.idToken || req.query?.idToken || "").trim();
}

export async function verifyRequestUser(req) {
  const idToken = getBearerToken(req);
  if (!idToken) {
    const error = new Error("Missing Firebase ID token.");
    error.statusCode = 401;
    throw error;
  }
  const decodedToken = await getAdminAuth().verifyIdToken(idToken, true);
  return { idToken, decodedToken };
}

export function jsonError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({ error: message, ...extra });
}

export async function logRuntimeEvent(type, payload = {}) {
  try {
    const db = getAdminDb();
    await db.collection("runtimeLogs").add({
      type: String(type || "event"),
      payload: payload && typeof payload === "object" ? payload : { value: String(payload || "") },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Runtime log write failed:", error);
  }
}
