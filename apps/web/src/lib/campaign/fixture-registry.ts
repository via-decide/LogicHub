import type { CampaignFixture } from './contracts';
import { tractorFixture } from './tractor-fixture';
import { omniWheelFixture } from './omni-wheel-fixture';

const fixtures: Record<string, CampaignFixture> = {
  [tractorFixture.campaign.id]: tractorFixture,
  [omniWheelFixture.campaign.id]: omniWheelFixture,
};

export function getCampaignFixture(campaignId: string): CampaignFixture | undefined {
  return fixtures[campaignId];
}

export const campaignFixtureIds = Object.keys(fixtures);
