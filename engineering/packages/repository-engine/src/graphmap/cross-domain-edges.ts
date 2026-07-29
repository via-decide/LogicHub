import type { GraphEdge } from './types.js';
import type { ConstraintSurface, DecisionSurface } from '../types.js';
import { sha256Hex } from '../util/hash.js';
import { jcsCanonicalize } from '../util/jcs.js';

export function generateCrossDomainEdges(
  constraintSurface: ConstraintSurface | null,
  decisionSurface: DecisionSurface | null,
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  if (constraintSurface) {
    for (const c of constraintSurface.constraints) {
      const constraintId = `constraint::${c.category}::${c.id}`;
      for (const target of c.targetSemanticKeys) {
        edges.push(makeEdge(
          target, 'CONSTRAINED_BY', constraintId,
          'declared', 'exact_semantic_key',
          { sourcePath: `constraints/${c.category}`, semanticLocator: `constraint::${c.id}::target::${target}` },
        ));
      }
    }
  }

  if (decisionSurface) {
    for (const d of decisionSurface.decisions) {
      const decisionId = `decision::${d.id}`;
      for (const key of d.affectedSemanticKeys) {
        edges.push(makeEdge(
          key, 'DECIDED_BY', decisionId,
          'declared', 'user_declared_mapping',
          { sourcePath: `decisions/${d.id}`, semanticLocator: `decision::${d.id}::affects::${key}` },
        ));
      }
    }
  }

  return edges;
}

function makeEdge(
  from: string, type: GraphEdge['type'], to: string,
  resolution: GraphEdge['resolution'],
  confidenceBasis: GraphEdge['confidenceBasis'],
  evidence: GraphEdge['evidence'],
): GraphEdge {
  const edgeId = sha256Hex(jcsCanonicalize({
    from, type, to, resolution,
    normalizedEvidenceIdentity: evidence.semanticLocator,
  }));

  return {
    edgeId,
    from,
    type,
    to,
    resolution,
    confidenceBasis,
    domain: 'cross_domain',
    evidence,
  };
}
