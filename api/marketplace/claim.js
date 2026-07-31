// LogicHub/api/marketplace/claim.js
// A vendor claims an open issue, forking it to a vendor branch.
//
// Persists three things atomically-in-intent (not in a real transaction —
// see the note below): the issue moves OPEN -> CLAIMED, a Claim record is
// created, and a PhysicalPullRequest starts at DRAFT. All three come from
// `workflow.ts`'s pure functions; this file only loads, calls them, and
// saves what they return.
import crypto from 'node:crypto';
import { applyCors } from '../_payments-config.js';
import { getAdminDb } from '../_pg.js';
import {
  canClaimIssue,
  markIssueClaimed,
  createPullRequestFromClaim,
} from '../../engineering/packages/physical-ci/dist/index.js';
import { ISSUES_COLLECTION } from './issues.js';

export const CLAIMS_COLLECTION = 'marketplace_claims';
export const PULL_REQUESTS_COLLECTION = 'marketplace_pull_requests';

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const issueId = String(req.body?.issueId || '').trim();
  const vendorId = String(req.body?.vendorId || '').trim();
  if (!issueId || !vendorId) {
    return res.status(400).json({ error: 'issueId_and_vendorId_required' });
  }

  const db = getAdminDb();
  const issueRef = db.collection(ISSUES_COLLECTION).doc(issueId);

  let issue;
  try {
    const snapshot = await issueRef.get();
    if (!snapshot.exists) {
      return res.status(404).json({ error: 'issue_not_found' });
    }
    issue = snapshot.data();
  } catch (error) {
    console.error('Failed to read issue for claim:', error);
    return res.status(503).json({ error: 'claim_unavailable' });
  }

  const decision = canClaimIssue(issue);
  if (!decision.allowed) {
    return res.status(409).json({ error: 'issue_not_claimable', message: decision.reason });
  }

  const now = new Date().toISOString();
  const claim = {
    id: `claim_${crypto.randomUUID()}`,
    issueId,
    vendorId,
    branchName: `${vendorId}/${issueId}`,
    claimedAt: now,
  };
  const pullRequest = createPullRequestFromClaim(`pr_${crypto.randomUUID()}`, issue, claim, now);
  const updatedIssue = markIssueClaimed(issue);

  try {
    // Not a real database transaction — the generic document store (api/_pg.js)
    // doesn't expose one, and adding one for a three-write sequence that isn't
    // itself the security-critical path (unlike payment verification, which
    // does use Postgres directly for its atomic increment) is more machinery
    // than this endpoint needs. If the second or third write fails, the issue
    // is left CLAIMED with no matching PR — a real, visible inconsistency an
    // operator would need to notice and clear manually, not a silent one.
    await issueRef.set(updatedIssue, { merge: true });
    await db.collection(CLAIMS_COLLECTION).doc(claim.id).set(claim);
    await db.collection(PULL_REQUESTS_COLLECTION).doc(pullRequest.id).set(pullRequest);
  } catch (error) {
    console.error('Failed to persist claim:', error);
    return res.status(503).json({ error: 'claim_not_recorded' });
  }

  return res.status(200).json({ claim, pullRequest });
}
