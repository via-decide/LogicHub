import { notFound } from 'next/navigation';
import CampaignConsole from './CampaignConsole';
import { tractorFixture } from '@/lib/campaign/tractor-fixture';

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  if (campaignId !== tractorFixture.campaign.id) notFound();
  return <CampaignConsole fixture={tractorFixture} />;
}
