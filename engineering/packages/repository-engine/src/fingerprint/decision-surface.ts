import type { DecisionSurface, DecisionSummaryEntry } from '../types.js';
import { sha256Hex, canonicalJson } from '../util/hash.js';
import { sortByKey } from '../util/deterministic.js';

export function extractDecisionSurface(
  decisionFiles: Array<{ path: string; content: string }>,
): DecisionSurface | null {
  const decisions: DecisionSummaryEntry[] = [];

  for (const file of decisionFiles) {
    let parsed: unknown;
    try { parsed = JSON.parse(file.content); } catch { continue; }

    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const d = item as Record<string, unknown>;

      const selectedAlternative = d.selectedAlternative as Record<string, unknown> | undefined;
      const selectedOptionHash = selectedAlternative
        ? sha256Hex(canonicalJson(selectedAlternative))
        : null;

      const affectedSemanticKeys: string[] = [];
      if (Array.isArray(d.constraintsConsidered)) {
        affectedSemanticKeys.push(...(d.constraintsConsidered as string[]));
      }
      if (Array.isArray(d.affectedSemanticKeys)) {
        affectedSemanticKeys.push(...(d.affectedSemanticKeys as string[]));
      }
      affectedSemanticKeys.sort();

      decisions.push({
        id: String(d.id ?? ''),
        subject: String(d.question ?? d.subject ?? ''),
        selectedOptionHash,
        affectedSemanticKeys,
        status: String(d.status ?? 'proposed'),
      });
    }
  }

  if (decisions.length === 0) return null;

  return {
    decisions: sortByKey(decisions, d => d.id),
  };
}
