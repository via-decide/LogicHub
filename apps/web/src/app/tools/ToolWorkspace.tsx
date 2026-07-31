'use client';

import { useState } from 'react';
import { ToolData } from './data/types';
import { useToolChecklist } from './useToolChecklist';
import Link from 'next/link';

export function ToolWorkspace({ tool }: { tool: ToolData }) {
  const [selectedProject, setSelectedProject] = useState<string>('default');
  const { checkedItems, toggleItem, mounted } = useToolChecklist(tool.id, selectedProject);

  const completedStagesCount = mounted 
    ? Object.keys(checkedItems).filter(k => checkedItems[parseInt(k, 10)]).length 
    : 0;
  
  const currentStageIndex = Math.min(
    Math.floor((completedStagesCount / Math.max(tool.checklist.length, 1)) * tool.stages.length),
    tool.stages.length - 1
  );

  return (
    <div className="min-h-screen bg-[#0A1220] text-[#F4F7FB] font-sans">
      <header className="p-8 border-b border-white/10 bg-gradient-to-br from-[#C9A84C]/10 to-[#0A1220]/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-[#C9A84C] uppercase tracking-widest text-xs font-bold mb-2">
            <Link href="/tools" className="hover:underline">Universal Tools</Link> / {tool.eyebrow.split('·')[1]?.trim() || 'Tool'}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">{tool.title}</h1>
          <p className="max-w-4xl text-lg text-[#DCE5F2]">{tool.lead}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 space-y-12">
        {/* Contract Table */}
        {tool.contractFields.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">Contract Definition</h2>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left collapse">
                <thead>
                  <tr className="bg-[#C9A84C]/10 text-[#FFF4CC]">
                    <th className="p-4 border-b border-white/10 font-bold">Layer</th>
                    <th className="p-4 border-b border-white/10 font-bold">Meaning</th>
                  </tr>
                </thead>
                <tbody className="bg-white/5 divide-y divide-white/10 text-[#AEB9C8]">
                  {tool.contractFields.map((field, i) => (
                    <tr key={i}>
                      <td className="p-4 align-top font-mono text-sm">{field.layer}</td>
                      <td className="p-4 align-top">{field.t_meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Project Applicability */}
        <section>
          <div className="flex justify-between items-end border-b border-white/10 pb-2 mb-4">
            <h2 className="text-2xl font-semibold">Project Applicability</h2>
            <div className="text-sm text-[#AEB9C8]">
              Selected Context: <span className="text-[#C9A84C] font-mono">{selectedProject === 'default' ? 'Generic Tool' : selectedProject}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              onClick={() => setSelectedProject('default')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedProject === 'default' 
                  ? 'border-[#C9A84C] bg-[#C9A84C]/10 shadow-[0_0_15px_rgba(201,168,76,0.2)]' 
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <h3 className="font-bold mb-2">Generic Context</h3>
              <p className="text-sm text-[#AEB9C8]">Use default tool constraints with no project-specific overrides.</p>
            </div>
            {tool.projects.map((proj, i) => (
              <div 
                key={i} 
                onClick={() => setSelectedProject(proj.name)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedProject === proj.name 
                    ? 'border-[#C9A84C] bg-[#C9A84C]/10 shadow-[0_0_15px_rgba(201,168,76,0.2)]' 
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <h3 className="font-bold mb-2">{proj.name}</h3>
                <p className="text-sm text-[#AEB9C8] line-clamp-3">{proj.content}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Two-column layout for Stages and Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Stage Map */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 border-b border-white/10 pb-2">Production Stages</h2>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[5.5rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
              {tool.stages.map((stage, i) => {
                const isActive = mounted && i === currentStageIndex;
                const isPassed = mounted && i < currentStageIndex;
                
                return (
                  <div key={i} className={`flex gap-4 p-4 rounded-xl border transition-all ${
                    isActive ? 'border-[#C9A84C] bg-[#C9A84C]/10' : 
                    isPassed ? 'border-[#41D675]/50 bg-[#41D675]/5' : 
                    'border-transparent'
                  }`}>
                    <div className={`font-mono text-sm shrink-0 w-20 pt-1 ${
                      isActive ? 'text-[#C9A84C] font-bold' : 
                      isPassed ? 'text-[#41D675]' : 
                      'text-[#AEB9C8]'
                    }`}>
                      {stage.num}
                    </div>
                    <div className={`text-sm ${
                      isActive ? 'text-[#F4F7FB]' : 
                      isPassed ? 'text-[#DCE5F2]' : 
                      'text-[#AEB9C8]'
                    }`}>
                      {stage.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Interactive Checklist */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 border-b border-white/10 pb-2">Design Checklist</h2>
            <div className="space-y-3">
              {tool.checklist.map((item, i) => {
                const checked = mounted ? !!checkedItems[i] : false;
                return (
                  <label 
                    key={i} 
                    className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                      checked 
                        ? 'border-[#41D675]/30 bg-[#41D675]/5' 
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <input 
                      type="checkbox"
                      className="mt-1 w-5 h-5 rounded border-white/20 bg-white/10 text-[#41D675] focus:ring-[#41D675]/50 focus:ring-offset-0"
                      checked={checked}
                      onChange={() => toggleItem(i)}
                    />
                    <span className={`text-sm leading-relaxed ${checked ? 'text-[#DCE5F2] line-through opacity-70' : 'text-[#DCE5F2]'}`}>
                      {item}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
