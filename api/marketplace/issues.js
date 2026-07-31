// LogicHub/api/marketplace/issues.js
// List open marketplace issues.
//
// Read-only. No auth is required to browse what's available to claim — the
// same posture as the public catalogue, not the vendor-only endpoints below.
import { applyCors } from '../_payments-config.js';
import { getAdminDb } from '../_pg.js';

export const ISSUES_COLLECTION = 'marketplace_issues';

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const db = getAdminDb();
    const rows = await db.collection(ISSUES_COLLECTION).list({ where: { field: 'status', value: 'OPEN' } });
    const issues = rows.map((row) => row.data());
    return res.status(200).json({ issues });
  } catch (error) {
    console.error('Failed to list marketplace issues:', error);
    return res.status(503).json({ error: 'issues_unavailable' });
  }
}
