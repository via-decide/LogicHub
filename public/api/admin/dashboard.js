import admin from "firebase-admin";
import { getAdminDb, jsonError, logRuntimeEvent } from "../_firebaseAdmin.js";

function authorized(req) {
  const expected = String(process.env.FIREBASE_ADMIN_SECRET || "").trim();
  const provided = String(req.headers?.["x-admin-secret"] || req.query?.adminSecret || req.body?.adminSecret || "").trim();
  return expected && provided && expected === provided;
}

export default async function handler(req, res) {
  if (!authorized(req)) return jsonError(res, 401, "Unauthorized admin action.");

  try {
    const db = getAdminDb();
    if (req.method === "GET") {
      const [paymentsSnap, appsSnap, installsSnap] = await Promise.all([
        db.collection("payments").where("status", "==", "pending").orderBy("timestamp", "desc").limit(100).get(),
        db.collection("apps").orderBy("created_at", "desc").limit(100).get(),
        db.collection("app_installs").orderBy("created_at", "desc").limit(200).get()
      ]);

      const installsByApp = {};
      installsSnap.forEach((doc) => {
        const data = doc.data() || {};
        const appId = String(data.app_id || "unknown");
        installsByApp[appId] = (installsByApp[appId] || 0) + 1;
      });

      return res.status(200).json({
        ok: true,
        pendingPayments: paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        apps: appsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), installs: installsByApp[doc.id] || 0 })),
        installMetrics: installsByApp
      });
    }

    if (req.method === "POST") {
      const paymentId = String(req.body?.paymentId || "").trim();
      const action = String(req.body?.action || "").trim().toLowerCase();
      if (!paymentId || !["approve", "reject", "remove_app"].includes(action)) {
        return jsonError(res, 400, "Missing paymentId/action or invalid action.");
      }

      if (action === "remove_app") {
        await db.collection("apps").doc(paymentId).delete();
        await logRuntimeEvent("admin_remove_app", { appId: paymentId });
        return res.status(200).json({ ok: true, message: "App removed." });
      }

      const paymentRef = db.collection("payments").doc(paymentId);
      const paymentSnap = await paymentRef.get();
      if (!paymentSnap.exists) return jsonError(res, 404, "Payment not found.");
      const payment = paymentSnap.data() || {};
      const uid = String(payment.user_id || "").trim();

      await paymentRef.set({
        status: action === "approve" ? "approved" : "rejected",
        reviewed_at: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      if (uid) {
        await db.collection("users").doc(uid).set({
          role: action === "approve" ? "founder" : "free",
          founderRequestStatus: action === "approve" ? "approved" : "rejected",
          paymentStatus: action === "approve" ? "active" : "rejected",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      await logRuntimeEvent("admin_payment_review", { paymentId, action, uid });
      return res.status(200).json({ ok: true, message: action === "approve" ? "Founder pass activated" : "Payment rejected" });
    }

    return jsonError(res, 405, "Method not allowed.");
  } catch (error) {
    return jsonError(res, 500, error.message || "Admin dashboard failed.");
  }
}
