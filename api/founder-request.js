import admin from "firebase-admin";
import { getAdminDb, jsonError, verifyRequestUser } from "./_firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "Method not allowed. Use POST.");
  }

  try {
    const { decodedToken } = await verifyRequestUser(req);
    const uid = decodedToken.uid;
    const db = getAdminDb();
    const order = req.body?.order || {};

    const orderId = String(order.id || "").trim();
    const utr = String(order.utr || "").replace(/\s+/g, "").trim();
    const projectName = String(order.projectName || "").trim();
    const amount = Number(order.amount || 0);
    const currency = String(order.currency || "INR").trim() || "INR";

    if (!orderId) return jsonError(res, 400, "Missing order id.");
    if (!/^\d{12}$/.test(utr)) return jsonError(res, 400, "UTR must be exactly 12 digits.");
    if (!projectName) return jsonError(res, 400, "Missing project name.");
    if (!Number.isFinite(amount) || amount <= 0) return jsonError(res, 400, "Invalid amount.");

    const requestRef = db.collection("founderRequests").doc(orderId);
    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const existing = await tx.get(requestRef);
      if (existing.exists) {
        const existingData = existing.data() || {};
        if (existingData.uid && existingData.uid !== uid) {
          throw new Error("Order id already belongs to another user.");
        }
      }

      tx.set(requestRef, {
        uid,
        orderId,
        utr,
        projectName,
        amount,
        currency,
        payment: String(order.payment || "upi"),
        plan: String(order.plan || "india_founder"),
        status: "requested",
        source: "logichub_ui",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      tx.set(userRef, {
        uid,
        latestOrderId: orderId,
        founderRequestStatus: "requested",
        paymentStatus: "pending",
        plan: String(order.plan || "india_founder"),
        amount,
        currency,
        hasFounderRequest: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    return res.status(200).json({
      ok: true,
      uid,
      orderId,
      status: "requested",
      message: "Founder request saved for manual review. Paid access will unlock after approval."
    });
  } catch (error) {
    console.error("Founder request save failed:", error);
    const statusCode = error.message === "Order id already belongs to another user." ? 409 : (error.statusCode || 500);
    return jsonError(res, statusCode, error.message || "Founder request save failed.");
  }
}
