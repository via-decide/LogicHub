/**
 * POST /api/analytics/event
 *
 * Public-facing endpoint that the LogicHub frontend calls to emit lifecycle events.
 * All 7 canonical funnel events are accepted here.
 *
 * Payload:
 *   {
 *     "event":     "apk_uploaded",          // required
 *     "userId":    "u123",                  // required
 *     "projectId": "p456",                  // optional
 *     "sessionId": "s789",                  // optional
 *     "metadata":  { "file_size": 18293421, "package_name": "com.example.app" }
 *   }
 *
 * Response:
 *   200 { "ok": true, "event": "apk_uploaded" }
 *   400 { "error": "..." }
 */

import { trackEvent, trackReturningUser, ANALYTICS_EVENTS } from "./_analyticsService.js";

const VALID_EVENTS = new Set(Object.values(ANALYTICS_EVENTS));

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Ecosystem-Uid"
  );
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed. Use POST." });

  const { event, userId, projectId, sessionId, metadata } = req.body || {};

  // Validate required fields
  if (!event || !userId) {
    return res
      .status(400)
      .json({ error: "Missing required fields: event and userId." });
  }

  if (!VALID_EVENTS.has(event)) {
    return res.status(400).json({
      error: `Unknown event "${event}". Valid events: ${[...VALID_EVENTS].join(", ")}`,
    });
  }

  // Fire the event
  await trackEvent(event, {
    userId:    String(userId),
    projectId: projectId ? String(projectId) : null,
    sessionId: sessionId ? String(sessionId) : null,
    metadata:  metadata && typeof metadata === "object" ? metadata : {},
  });

  // If this is a session-start-type event, also check returning user status
  if (event === ANALYTICS_EVENTS.SIGNUP_COUNT || event === ANALYTICS_EVENTS.PROJECT_CREATED) {
    await trackReturningUser(String(userId));
  }

  return res.status(200).json({ ok: true, event });
}
