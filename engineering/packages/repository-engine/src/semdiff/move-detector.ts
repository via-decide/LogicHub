import type { SourceFileEntry, SoftwareFileSurface } from '../types.js';

export interface MoveCandidate {
  basePath: string;
  proposedPath: string;
  matchType: 'strict' | 'alpha_normalized';
  baseSemanticId: string;
  proposedSemanticId: string;
}

export function detectFileMoves(
  baseInventory: SourceFileEntry[],
  proposedInventory: SourceFileEntry[],
): MoveCandidate[] {
  const candidates: MoveCandidate[] = [];

  const basePaths = new Set(baseInventory.map(e => e.path));
  const proposedPaths = new Set(proposedInventory.map(e => e.path));

  const removedFiles = baseInventory.filter(e => !proposedPaths.has(e.path));
  const addedFiles = proposedInventory.filter(e => !basePaths.has(e.path));

  const addedByHash = new Map<string, SourceFileEntry[]>();
  for (const file of addedFiles) {
    if (!file.contentHash) continue;
    const existing = addedByHash.get(file.contentHash) ?? [];
    existing.push(file);
    addedByHash.set(file.contentHash, existing);
  }

  const matched = new Set<string>();

  for (const removed of removedFiles) {
    if (!removed.contentHash) continue;
    const matchingAdded = addedByHash.get(removed.contentHash);
    if (matchingAdded && matchingAdded.length > 0) {
      const added = matchingAdded[0];
      if (!matched.has(added.path)) {
        candidates.push({
          basePath: removed.path,
          proposedPath: added.path,
          matchType: 'strict',
          baseSemanticId: `software::${removed.path}`,
          proposedSemanticId: `software::${added.path}`,
        });
        matched.add(added.path);
      }
    }
  }

  return candidates;
}

export function detectSymbolMoves(
  baseExports: Array<{ semanticId: string; bodyHash: string; alphaNormalizedBodyHash: string }>,
  proposedExports: Array<{ semanticId: string; bodyHash: string; alphaNormalizedBodyHash: string }>,
): MoveCandidate[] {
  const candidates: MoveCandidate[] = [];
  const baseIds = new Set(baseExports.map(e => e.semanticId));
  const proposedIds = new Set(proposedExports.map(e => e.semanticId));

  const removedExports = baseExports.filter(e => !proposedIds.has(e.semanticId));
  const addedExports = proposedExports.filter(e => !baseIds.has(e.semanticId));

  const addedByStrictHash = new Map<string, typeof addedExports[0][]>();
  const addedByAlphaHash = new Map<string, typeof addedExports[0][]>();
  for (const exp of addedExports) {
    const strict = addedByStrictHash.get(exp.bodyHash) ?? [];
    strict.push(exp);
    addedByStrictHash.set(exp.bodyHash, strict);

    const alpha = addedByAlphaHash.get(exp.alphaNormalizedBodyHash) ?? [];
    alpha.push(exp);
    addedByAlphaHash.set(exp.alphaNormalizedBodyHash, alpha);
  }

  const matchedAdded = new Set<string>();

  for (const removed of removedExports) {
    const strictMatches = addedByStrictHash.get(removed.bodyHash);
    if (strictMatches) {
      const unmatched = strictMatches.find(m => !matchedAdded.has(m.semanticId));
      if (unmatched) {
        candidates.push({
          basePath: removed.semanticId,
          proposedPath: unmatched.semanticId,
          matchType: 'strict',
          baseSemanticId: removed.semanticId,
          proposedSemanticId: unmatched.semanticId,
        });
        matchedAdded.add(unmatched.semanticId);
        continue;
      }
    }

    const alphaMatches = addedByAlphaHash.get(removed.alphaNormalizedBodyHash);
    if (alphaMatches) {
      const unmatched = alphaMatches.find(m => !matchedAdded.has(m.semanticId));
      if (unmatched) {
        candidates.push({
          basePath: removed.semanticId,
          proposedPath: unmatched.semanticId,
          matchType: 'alpha_normalized',
          baseSemanticId: removed.semanticId,
          proposedSemanticId: unmatched.semanticId,
        });
        matchedAdded.add(unmatched.semanticId);
      }
    }
  }

  return candidates;
}
