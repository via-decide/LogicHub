import { notFound } from 'next/navigation';
import CampaignConsole from './CampaignConsole';
import { getCampaignFixture } from '@/lib/campaign/fixture-registry';

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const fixture = getCampaignFixture(campaignId);
  if (!fixture) notFound();
  return <CampaignConsole fixture={fixture} />;
}
