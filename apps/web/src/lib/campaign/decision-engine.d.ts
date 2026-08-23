import type { CampaignFixture } from './contracts';

export interface CampaignEvaluation {
  decision: 'SUPPORTED' | 'CONDITIONALLY_SUPPORTED' | 'FAILED' | 'INCONCLUSIVE';
  claimState: string;
  reasons: string[];
  linkedTestIds: string[];
  linkedEvidenceIds: string[];
  counts: Record<string, number>;
  validation: { valid: boolean; errors: string[] };
}

export function validateCampaignData(input: Partial<CampaignFixture>): { valid: boolean; errors: string[] };
export function applyRevisionChange<T extends Partial<CampaignFixture>>(input: T, change: Record<string, unknown>): T & { revisionImpact: { changeId?: string; affectedEvidenceIds: string[]; affectedTestIds: string[] } };
export function aggregateDependencies(input: Partial<CampaignFixture>): Array<Record<string, unknown>>;
export function evaluateCampaign(input: Partial<CampaignFixture>): CampaignEvaluation;
