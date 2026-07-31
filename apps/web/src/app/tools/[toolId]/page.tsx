import { notFound } from 'next/navigation';
import { allTools } from '../data';
import { ToolWorkspace } from '../ToolWorkspace';
import { Metadata } from 'next';

export function generateStaticParams() {
  return allTools.map((tool) => ({
    toolId: tool.id,
  }));
}

export function generateMetadata({ params }: { params: { toolId: string } }): Metadata {
  const tool = allTools.find((t) => t.id === params.toolId);
  if (!tool) return {};
  
  return {
    title: `${tool.eyebrow.split('·')[1]?.trim() || 'Tool'} — ${tool.title}`,
    description: tool.lead,
  };
}

export default function ToolPage({ params }: { params: { toolId: string } }) {
  const tool = allTools.find((t) => t.id === params.toolId);
  
  if (!tool) {
    notFound();
  }

  return <ToolWorkspace tool={tool} />;
}
