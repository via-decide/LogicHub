import { notFound } from 'next/navigation';
import { allTools } from '../data';
import { ToolWorkspace } from '../ToolWorkspace';
import { Metadata } from 'next';

export function generateStaticParams() {
  return allTools.map((tool) => ({
    toolId: tool.id,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ toolId: string }> }): Promise<Metadata> {
  const { toolId } = await params;
  const tool = allTools.find((t) => t.id === toolId);
  if (!tool) return {};

  return {
    title: `${tool.eyebrow.split('·')[1]?.trim() || 'Tool'} — ${tool.title}`,
    description: tool.lead,
  };
}

export default async function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const tool = allTools.find((t) => t.id === toolId);

  if (!tool) {
    notFound();
  }

  return <ToolWorkspace tool={tool} />;
}
