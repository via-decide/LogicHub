import { getAdminAuth, getAdminDb, jsonError, verifyRequestUser } from "./_firebaseAdmin.js";
import { trackEvent, trackReturningUser, ANALYTICS_EVENTS } from "./_analyticsService.js";

function isApprovedStatus(value) {
  return ["active", "approved", "confirmed", "paid", "pro"].includes(String(value || "").toLowerCase());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Ecosystem-Uid');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

    let paidByStudent = false;
    try {
      const gatewayUrl = process.env.GATEWAY_URL || "https://daxini.xyz";
      const res = await fetch(`${gatewayUrl}/api/verify/student/status?userId=${encodeURIComponent(uid)}&t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.verified) {
          paidByStudent = true;
        }
      }
    } catch (e) {
      console.warn("[ACCESS_STATUS] Gateway Student Check Failed:", e.message);
    }

    const paidByFirestore = paidDoc.paid === true || isApprovedStatus(paidDoc.status) || userDoc.paid === true || isApprovedStatus(userDoc.paymentStatus);
    const pending = !paidByClaim && !paidByFirestore && !paidByStudent && (
      String(userDoc.founderRequestStatus || "").toLowerCase() === "requested" ||
      String(userDoc.paymentStatus || "").toLowerCase() === "pending"
    );

    const paid = paidByClaim || paidByFirestore || paidByStudent;
    const source = paidByStudent ? "student_verification" : (paidByClaim ? "custom_claims" : paidByFirestore ? "firestore" : pending ? "pending_request" : "free");
    const plan = paidByStudent ? "student" : (paidDoc.plan || userDoc.plan || claims.plan || (paid ? "founder" : pending ? "pending" : "free"));

    const isNewUser = !userDocSnap.exists;

    // Analytics: signup_count on first-ever verified access
    if (isNewUser) {
      await trackEvent(ANALYTICS_EVENTS.SIGNUP_COUNT, {
        userId: uid,
        metadata: { plan, source },
      });
    }

    // Analytics: returning_users check (24 h gate is inside helper)
    await trackReturningUser(uid);

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
