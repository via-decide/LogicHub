import Link from 'next/link';
import { allTools } from './data';

export const metadata = {
  title: 'Universal Hardware Production Tools',
  description: 'Interactive guides for hardware production.',
};

export default function ToolsIndex() {
  return (
    <div className="min-h-screen bg-[#0A1220] text-[#F4F7FB] font-sans">
      <header className="p-8 border-b border-white/10 bg-gradient-to-br from-[#C9A84C]/10 to-[#0A1220]/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-[#C9A84C] uppercase tracking-widest text-xs font-bold mb-2">
            LogicHub Production
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">Universal Hardware Tools</h1>
          <p className="max-w-4xl text-lg text-[#DCE5F2]">
            14 production tools covering power, telemetry, fault-tolerance, and QA validation. 
            Designed to bridge the gap between software iteration speed and physical hardware constraints.
          </p>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allTools.map(tool => (
            <Link 
              key={tool.id} 
              href={`/tools/${tool.id}`}
              className="block p-6 rounded-xl border border-white/10 bg-white/5 hover:border-[#C9A84C]/50 hover:bg-[#C9A84C]/5 transition-all h-full flex flex-col"
            >
              <div className="text-[#C9A84C] text-xs font-bold mb-2 uppercase tracking-wider">
                {tool.eyebrow.split('·')[1]?.trim() || 'Tool'}
              </div>
              <h2 className="text-xl font-bold mb-3">{tool.title}</h2>
              <p className="text-sm text-[#AEB9C8] flex-grow line-clamp-4">{tool.lead}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
