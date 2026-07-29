import type { ConstraintSurface, ConstraintSummaryEntry } from '../types.js';
import { sha256Hex, canonicalJson } from '../util/hash.js';
import { sortByKeys } from '../util/deterministic.js';

export function extractConstraintSurface(
  constraintFiles: Array<{ path: string; content: string }>,
): ConstraintSurface | null {
  const constraints: ConstraintSummaryEntry[] = [];

  for (const file of constraintFiles) {
    let parsed: unknown;
    try { parsed = JSON.parse(file.content); } catch { continue; }

    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const c = item as Record<string, unknown>;

      const targetSemanticKeys = Array.isArray(c.targetObjectIds)
        ? (c.targetObjectIds as string[]).sort()
        : Array.isArray(c.targetSemanticKeys)
          ? (c.targetSemanticKeys as string[]).sort()
          : [];

      const entry: ConstraintSummaryEntry = {
        id: String(c.id ?? ''),
        category: String(c.category ?? 'unknown'),
        severity: String(c.severity ?? 'info'),
        targetSemanticKeys,
        normalizedExpression: typeof c.expression === 'string'
          ? c.expression
          : canonicalJson(c.expression ?? null),
        unit: c.unit ? String(c.unit) : null,
        expectedValue: c.expected != null ? canonicalJson(c.expected) : null,
        source: c.source ? String(c.source) : null,
        semanticHash: sha256Hex(canonicalJson({
          id: c.id,
          category: c.category,
          severity: c.severity,
          expression: c.expression,
          expected: c.expected,
        })),
      };
      constraints.push(entry);
    }
  }

  if (constraints.length === 0) return null;

  return {
    constraints: sortByKeys(constraints, [
      c => c.category,
      c => c.severity,
      c => c.id,
    ]),
  };
}
