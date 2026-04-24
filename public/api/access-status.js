import { getAdminAuth, getAdminDb, jsonError, verifyRequestUser } from "./_firebaseAdmin.js";

function isApprovedStatus(value) {
  return ["active", "approved", "confirmed", "paid", "pro"].includes(String(value || "").toLowerCase());
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "Method not allowed. Use POST.");
  }

  try {
    const { decodedToken } = await verifyRequestUser(req);
    const uid = decodedToken.uid;
    const auth = getAdminAuth();
    const db = getAdminDb();

    const [userRecord, paidDocSnap, userDocSnap] = await Promise.all([
      auth.getUser(uid),
      db.collection("paidUsers").doc(uid).get(),
      db.collection("users").doc(uid).get()
    ]);

    const claims = userRecord.customClaims || {};
    const paidByClaim = claims.paid === true || isApprovedStatus(claims.planStatus) || isApprovedStatus(claims.accessLevel);

    const paidDoc = paidDocSnap.exists ? paidDocSnap.data() || {} : {};
    const userDoc = userDocSnap.exists ? userDocSnap.data() || {} : {};

    const paidByFirestore = paidDoc.paid === true || isApprovedStatus(paidDoc.status) || userDoc.paid === true || isApprovedStatus(userDoc.paymentStatus);
    const pending = !paidByClaim && !paidByFirestore && (
      String(userDoc.founderRequestStatus || "").toLowerCase() === "requested" ||
      String(userDoc.paymentStatus || "").toLowerCase() === "pending"
    );

    const paid = paidByClaim || paidByFirestore;
    const source = paidByClaim ? "custom_claims" : paidByFirestore ? "firestore" : pending ? "pending_request" : "free";
    const plan = paidDoc.plan || userDoc.plan || claims.plan || (paid ? "founder" : pending ? "pending" : "free");

    return res.status(200).json({
      ok: true,
      uid,
      paid,
      pending,
      source,
      plan,
      paymentStatus: paid ? "active" : pending ? "pending" : "free",
      checkedAt: new Date().toISOString(),
      user: {
        email: userRecord.email || null,
        anonymous: !!decodedToken.firebase?.sign_in_provider && decodedToken.firebase.sign_in_provider === "anonymous"
      },
      access: {
        claimPaid: paidByClaim,
        firestorePaid: paidByFirestore,
        latestOrderId: userDoc.latestOrderId || paidDoc.orderId || null,
        amount: paidDoc.amount || userDoc.amount || null,
        currency: paidDoc.currency || userDoc.currency || null
      }
    });
  } catch (error) {
    console.error("Access status check failed:", error);
    const statusCode = error.statusCode || 401;
    return jsonError(res, statusCode, error.message || "Access status check failed.");
  }
}
