import crypto from 'node:crypto';
import { getAdminDb } from '../api/_pg.js';

// Vercel functions have a read-only filesystem (writes to cwd fail with
// EROFS, and /tmp doesn't survive between invocations anyway), so traces
// go through the same Postgres-backed document store as everything else
// in api/marketplace/*.js rather than a local JSONL file.
export const ZAYVORA_TRACES_COLLECTION = 'zayvora_traces';

export async function captureTask(interactionData) {
  const task = {
    task_id: crypto.randomUUID(),
    task_type: interactionData.type,
    timestamp: new Date().toISOString(),
    user_id: interactionData.userId || 'anonymous',
    hardware_project: interactionData.projectContext || 'unknown',

    input: interactionData.request,
    zayvora_output: interactionData.zayvoraResponse || null,
    ground_truth: interactionData.ground_truth || null,
    outcome: interactionData.outcome || null,
  };

  const db = getAdminDb();
  await db.collection(ZAYVORA_TRACES_COLLECTION).doc(task.task_id).set(task);
}
