import admin from "firebase-admin";
import { getAdminDb, jsonError, verifyRequestUser } from "./_firebaseAdmin.js";

function shouldNotifyFounderReview(order) {
  return Number(order?.amount || 0) === 1717 && String(order?.currency || "INR").toUpperCase() === "INR";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

async function sendFounderReviewEmail({ uid, decodedToken, order }) {
  if (!shouldNotifyFounderReview(order)) {
    return { attempted: false, sent: false, skipped: true, reason: "not_india_founder_pass" };
  }

  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || "").trim();
  if (!apiKey || !from) {
    return { attempted: false, sent: false, skipped: true, reason: "email_env_missing" };
  }

  const buyerEmail = String(decodedToken?.email || "").trim();
  const createdAt = new Date().toISOString();
  const subject = `LogicHub founder payment verification • ${order.orderId}`;
  const text = [
    "Hi Dharam,",
    "",
    "Please verify and approve this LogicHub India Founder Pass payment.",
    "",
    `Order ID: ${order.orderId}`,
    `Project: ${order.projectName}`,
    `Amount: ₹${Number(order.amount || 0).toLocaleString("en-IN")}`,
    `Currency: ${order.currency}`,
    `Plan: ${order.plan}`,
    `Payment mode: ${order.payment}`,
    `UTR: ${order.utr}`,
    `UPI ID paid to: ${order.upiId || "6351537770@yapl"}`,
    `Buyer email: ${buyerEmail || "Not available"}`,
    `Buyer uid: ${uid}`,
    `Submitted at: ${createdAt}`,
    "",
    "Please verify the payment and approve founder access.",
    "",
    "Sent from the LogicHub founder flow."
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:640px">
      <h2 style="margin-bottom:12px">LogicHub founder payment verification</h2>
      <p>Please verify and approve this LogicHub India Founder Pass payment.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tbody>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Order ID</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(order.orderId)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Project</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(order.projectName)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Amount</strong></td><td style="padding:8px;border:1px solid #ddd">₹${escapeHtml(Number(order.amount || 0).toLocaleString("en-IN"))}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Currency</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(order.currency)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Plan</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(order.plan)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Payment mode</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(order.payment)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>UTR</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(order.utr)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>UPI ID paid to</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(order.upiId || "6351537770@yapl")}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Buyer email</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(buyerEmail || "Not available")}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Buyer uid</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(uid)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Submitted at</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(createdAt)}</td></tr>
        </tbody>
      </table>
      <p>Please verify the payment and approve founder access.</p>
    </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: ["dharam@viadecide.com"],
      subject,
      html,
      text,
      ...(buyerEmail ? { reply_to: buyerEmail } : {})
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Email send failed with status ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  return { attempted: true, sent: true, skipped: false, provider: "resend", id: data?.id || null };
}

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
    const payment = String(order.payment || "upi").trim() || "upi";
    const plan = String(order.plan || "india_founder").trim() || "india_founder";
    const upiId = String(order.upiId || "6351537770@yapl").trim() || "6351537770@yapl";

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
        payment,
        plan,
        upiId,
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
        plan,
        amount,
        currency,
        hasFounderRequest: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    let emailNotification = { attempted: false, sent: false, skipped: true, reason: "not_attempted" };
    try {
      emailNotification = await sendFounderReviewEmail({
        uid,
        decodedToken,
        order: { orderId, utr, projectName, amount, currency, payment, plan, upiId }
      });
    } catch (emailError) {
      console.error("Founder review email failed:", emailError);
      emailNotification = { attempted: true, sent: false, skipped: false, error: emailError.message || "Email send failed." };
    }

    const needsManualEmail = shouldNotifyFounderReview({ amount, currency }) && !emailNotification.sent;
    const message = emailNotification.sent
      ? "Founder request saved for manual review. Payment details were emailed to dharam@viadecide.com for approval."
      : needsManualEmail
        ? "Founder request saved for manual review. Please send the drafted email to dharam@viadecide.com so approval can be completed."
        : "Founder request saved for manual review. Paid access will unlock after approval.";

    return res.status(200).json({
      ok: true,
      uid,
      orderId,
      status: "requested",
      needsManualEmail,
      emailNotification,
      message
    });
  } catch (error) {
    console.error("Founder request save failed:", error);
    const statusCode = error.message === "Order id already belongs to another user." ? 409 : (error.statusCode || 500);
    return jsonError(res, statusCode, error.message || "Founder request save failed.");
  }
}
