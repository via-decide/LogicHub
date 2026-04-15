import admin from "firebase-admin";
import { getAdminAuth, getAdminDb, jsonError } from "./_firebaseAdmin.js";

function authorized(req) {
  const expected = String(process.env.FIREBASE_ADMIN_SECRET || "").trim();
  const provided = String(req.headers?.["x-admin-secret"] || req.body?.adminSecret || "").trim();
  return expected && provided && expected === provided;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "Method not allowed. Use POST.");
  }
  if (!authorized(req)) {
    return jsonError(res, 401, "Unauthorized admin action.");
  }

  try {
    const uid = String(req.body?.uid || "").trim();
    const paid = req.body?.paid !== false;
    const mode = String(req.body?.mode || "both").toLowerCase();
    const plan = String(req.body?.plan || "founder").trim() || "founder";
    const orderId = String(req.body?.orderId || "").trim() || null;
    const amount = Number(req.body?.amount || 1717);
    const currency = String(req.body?.currency || "INR").trim() || "INR";
    const note = String(req.body?.note || "").trim() || null;

    if (!uid) return jsonError(res, 400, "Missing uid.");

    const auth = getAdminAuth();
    const db = getAdminDb();
    const userRecord = await auth.getUser(uid);
    const existingClaims = userRecord.customClaims || {};

    if (mode === "both" || mode === "claims") {
      await auth.setCustomUserClaims(uid, {
        ...existingClaims,
        paid,
        plan,
        accessLevel: paid ? "paid" : "free",
        planStatus: paid ? "active" : "revoked"
      });
    }

    if (mode === "both" || mode === "firestore") {
      await db.collection("paidUsers").doc(uid).set({
        uid,
        paid,
        status: paid ? "active" : "revoked",
        plan,
        orderId,
        amount,
        currency,
        note,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        grantedAt: paid ? admin.firestore.FieldValue.serverTimestamp() : null
      }, { merge: true });
    }

    await db.collection("users").doc(uid).set({
      uid,
      paid,
      plan,
      latestOrderId: orderId,
      founderRequestStatus: paid ? "approved" : "revoked",
      paymentStatus: paid ? "active" : "revoked",
      amount,
      currency,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return res.status(200).json({
      ok: true,
      uid,
      paid,
      plan,
      mode,
      message: paid ? "Paid access granted." : "Paid access revoked."
    });
  } catch (error) {
    console.error("Admin paid grant failed:", error);
    return jsonError(res, 500, error.message || "Admin paid grant failed.");
  }
}
