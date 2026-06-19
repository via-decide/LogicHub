import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { firestoreCompat, Filter } from "./_sovereignDb.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getAdminDb() {
  return firestoreCompat;
}

class AuthMock {
  async getUser(uid) {
    const db = getAdminDb();
    const snap = await db.collection("users").doc(uid).get();
    if (snap.exists) {
      const data = snap.data();
      return {
        uid,
        email: data.email || uid,
        customClaims: data.customClaims || {}
      };
    }
    return {
      uid,
      email: uid,
      customClaims: {}
    };
  }

  async setCustomUserClaims(uid, claims) {
    const db = getAdminDb();
    await db.collection("users").doc(uid).set({
      customClaims: claims
    }, { merge: true });
  }
}

const authMockInstance = new AuthMock();

export function getAdminAuth() {
  return authMockInstance;
}

export function getBearerToken(req) {
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || "");
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return String(req.body?.idToken || req.query?.idToken || "").trim();
}

export async function verifyRequestUser(req) {
  const idToken = getBearerToken(req);
  if (!idToken) {
    const error = new Error("Missing ID token.");
    error.statusCode = 401;
    throw error;
  }

  // 1. Try local Aporaksha HMAC-SHA256 JWT
  try {
    const secret = process.env.SECRET_KEY || "zayvora_dev_access_secret";
    const parts = idToken.split(".");
    if (parts.length === 3) {
      const [header, body, sig] = parts;
      const data = `${header}.${body}`;
      const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
      if (expected === sig) {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        if (payload.exp && Math.floor(Date.now() / 1000) <= payload.exp) {
          return { idToken, decodedToken: { uid: payload.ecosystem_uid, email: payload.ecosystem_uid, isPassport: true } };
        }
      }
    }
  } catch(e) {
    if (process.env.NODE_ENV === 'development') console.warn('[Auth hmac validation failed]', e);
  }

  // 2. Try Aporaksha REST introspect (port 7002)
  try {
    const res = await fetch("http://localhost:7002/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({ action: "introspect" })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.active || data.valid || data.success) {
        const uid = data.uid || data.user?.uid || data.email;
        const email = data.email || data.user?.email || uid;
        return { idToken, decodedToken: { uid, email } };
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.warn('[Auth REST introspect failed]', e);
  }

  // 3. Try Mac Mini challenge-verify via node.daxini.xyz
  try {
    const macminiUrl = process.env.MACMINI_URL || "https://node.daxini.xyz";
    const res = await fetch(`${macminiUrl}/auth/verify`, {
      headers: {
        "Authorization": idToken.startsWith("Bearer ") ? idToken : `Bearer ${idToken}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "valid" && data.user) {
        return { idToken, decodedToken: { uid: data.user.email, email: data.user.email } };
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.warn('[Auth challenge-verify failed]', e);
  }

  const error = new Error("Invalid or expired ID token.");
  error.statusCode = 401;
  throw error;
}

export function jsonError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({ error: message, ...extra });
}

export async function logRuntimeEvent(type, payload = {}) {
  const now = new Date().toISOString();
  try {
    const db = getAdminDb();
    await db.collection("runtime_logs").doc().set({
      type: String(type || "event"),
      payload: payload && typeof payload === "object" ? payload : { value: String(payload || "") },
      created_at: now
    });
  } catch (error) {
    console.error("Runtime log write to SQLite failed:", error);
  }

  try {
    const dataDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const logPath = path.join(dataDir, "events.jsonl");
    const entry = JSON.stringify({
      timestamp: now,
      type: String(type || "event"),
      payload: payload && typeof payload === "object" ? payload : { value: String(payload || "") }
    });
    fs.appendFileSync(logPath, entry + "\n", "utf8");
  } catch (error) {
    console.error("Runtime log write to events.jsonl failed:", error);
  }
}

export function verifyLoreKey() {
  return false;
}

const adminMock = {
  firestore: {
    FieldValue: {
      increment: (n) => ({ __type: "increment", value: n }),
      serverTimestamp: () => ({ __type: "serverTimestamp" }),
    },
    Timestamp: {
      fromDate: (date) => ({ __type: "timestamp", value: date.toISOString() }),
      now: () => ({ __type: "timestamp", value: new Date().toISOString() }),
    }
  }
};

export default adminMock;
export { Filter };
