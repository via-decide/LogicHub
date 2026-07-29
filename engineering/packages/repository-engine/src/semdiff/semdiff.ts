import type { FingerprintDescriptor } from '../types.js';
import type { GraphMapResult } from '../graphmap/graphmap.js';
import type { DeltaRecord, ImpactRecord, StalenessRecord, EngineeringPrSummary } from './types.js';
import type { ReplayDocument } from './replay-builder.js';
import { generateDeltas } from './delta-emitter.js';
import { analyzeImpact, detectStaleEvidence } from './impact-analyzer.js';
import { buildReplayDocument, verifyReplay } from './replay-builder.js';
import { buildPrSummary } from './pr-summary-builder.js';

export interface SemDiffInput {
  base: {
    fingerprint: FingerprintDescriptor;
    graphMap: GraphMapResult | null;
  };
  proposed: {
    fingerprint: FingerprintDescriptor;
    graphMap: GraphMapResult | null;
  };
}

export interface SemDiffResult {
  deltas: DeltaRecord[];
  impacts: ImpactRecord[];
  staleEvidence: StalenessRecord[];
  replay: ReplayDocument;
  replayVerified: boolean;
  replayErrors: string[];
  prSummary: EngineeringPrSummary;
}

export function computeSemDiff(input: SemDiffInput): SemDiffResult {
  const { base, proposed } = input;

  const deltas = generateDeltas(
    base.fingerprint,
    proposed.fingerprint,
    base.graphMap,
    proposed.graphMap,
  );

  const impacts = analyzeImpact(
    deltas,
    base.graphMap,
    proposed.graphMap,
  );

  const staleEvidence = detectStaleEvidence(
    deltas,
    proposed.graphMap,
  );

  const replay = buildReplayDocument(
    deltas,
    base.fingerprint,
    proposed.fingerprint,
  );

  const { verified: replayVerified, errors: replayErrors } = verifyReplay(
    base.fingerprint,
    proposed.fingerprint,
    replay.operations,
  );

  const prSummary = buildPrSummary(
    base.fingerprint,
    proposed.fingerprint,
    deltas,
    impacts,
    staleEvidence,
  );

  return {
    deltas,
    impacts,
    staleEvidence,
    replay,
    replayVerified,
    replayErrors,
    prSummary,
  };
}
