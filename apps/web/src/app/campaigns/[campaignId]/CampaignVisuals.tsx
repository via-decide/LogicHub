'use client';

import { useMemo, useState } from 'react';
import type { Dependency, TestEvent, TimeSeriesPoint, TimeSeriesSeries } from '@/lib/campaign/contracts';

const STATUS_STYLE: Record<string, string> = {
  SUPPORTED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', PASS: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', REVIEWED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', REPLICATED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', EXTERNALLY_VERIFIED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  CONDITIONALLY_SUPPORTED: 'border-amber-500/40 bg-amber-500/10 text-amber-300', CONDITIONAL: 'border-amber-500/40 bg-amber-500/10 text-amber-300', WARNING: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  FAIL: 'border-red-500/40 bg-red-500/10 text-red-300', FAILED: 'border-red-500/40 bg-red-500/10 text-red-300', BLOCKED: 'border-red-500/40 bg-red-500/10 text-red-300', INVALIDATED: 'border-red-500/40 bg-red-500/10 text-red-300',
  STALE: 'border-purple-500/40 bg-purple-500/10 text-purple-300', REVIEW_REQUIRED: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
  INCONCLUSIVE: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300', UNTESTED: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300', MISSING: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300', UNAVAILABLE: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  TESTING: 'border-blue-500/40 bg-blue-500/10 text-blue-300', READY: 'border-blue-500/40 bg-blue-500/10 text-blue-300', RUNNING: 'border-blue-500/40 bg-blue-500/10 text-blue-300', PRESENT: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
};
const STATUS_ICON: Record<string, string> = { SUPPORTED: '✓', PASS: '✓', REVIEWED: '✓', REPLICATED: '✓', EXTERNALLY_VERIFIED: '✓', CONDITIONALLY_SUPPORTED: '⚠', CONDITIONAL: '⚠', WARNING: '⚠', FAIL: '✕', FAILED: '✕', BLOCKED: '✕', INVALIDATED: '✕', STALE: '↻', REVIEW_REQUIRED: '↻', INCONCLUSIVE: '?', UNTESTED: '—', TESTING: '•', READY: '•', RUNNING: '•', PRESENT: '•', MISSING: '—', UNAVAILABLE: '—' };

export function StatusBadge({ state, compact = false }: { state: string; compact?: boolean }) {
  const style = STATUS_STYLE[state] ?? 'border-zinc-600 bg-zinc-900 text-zinc-300';
  return <span className={`inline-flex items-center gap-1 rounded border font-mono font-bold uppercase tracking-wide ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} ${style}`}><span aria-hidden="true">{STATUS_ICON[state] ?? '•'}</span><span>{state.replaceAll('_', ' ')}</span></span>;
}

interface AggregatedDependency extends Dependency { status: string; testCount: number; completedTestCount: number; evidenceCount: number; coveragePct: number; }

export function DependencyGraph({ dependencies, selectedId, onSelect }: { dependencies: AggregatedDependency[]; selectedId: string | null; onSelect: (id: string) => void; }) {
  const positions = [[55,36],[285,36],[515,36],[55,156],[515,156],[55,276],[285,276],[515,276],[285,386]];
  const root = { x: 285, y: 156, w: 170, h: 78 };
  return <svg viewBox="0 0 740 490" className="w-full rounded-xl border border-white/10 bg-black/30" role="group" aria-label="Claim dependency graph">
    {dependencies.map((d,i) => { const [x,y]=positions[i] ?? [55,386]; return <line key={`edge-${d.id}`} x1={root.x+root.w/2} y1={root.y+root.h/2} x2={x+75} y2={y+38} stroke="#3f3f46" strokeWidth="1.5"/>; })}
    <rect x={root.x} y={root.y} width={root.w} height={root.h} rx="10" fill="#18181b" stroke="#60a5fa" strokeWidth="2"/><text x={root.x+14} y={root.y+28} fill="#93c5fd" fontSize="12" fontWeight="700">CLAIM</text><text x={root.x+14} y={root.y+50} fill="#f4f4f5" fontSize="11">DEFINED DUTY</text><text x={root.x+14} y={root.y+66} fill="#a1a1aa" fontSize="9">evidence-bound support</text>
    {dependencies.map((d,i) => { const [x,y]=positions[i] ?? [55,386]; const selected=selectedId===d.id; const stroke=d.status==='FAILED'?'#ef4444':d.status==='SUPPORTED'?'#22c55e':d.status==='CONDITIONAL'?'#f59e0b':'#a1a1aa'; return <g key={d.id} role="button" tabIndex={0} aria-label={`${d.name}, ${d.status}, ${d.coveragePct}% test coverage`} className="cursor-pointer outline-none" onClick={()=>onSelect(d.id)} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' ') onSelect(d.id);}}><rect x={x} y={y} width="150" height="76" rx="9" fill={selected?'#27272a':'#18181b'} stroke={stroke} strokeWidth={selected?3:1.5}/><text x={x+12} y={y+23} fill="#f4f4f5" fontSize="11" fontWeight="700">{d.name.toUpperCase().slice(0,18)}</text><text x={x+12} y={y+43} fill={stroke} fontSize="10" fontWeight="700">{d.status}</text><text x={x+12} y={y+60} fill="#a1a1aa" fontSize="9">{d.completedTestCount}/{d.testCount} tests · {d.evidenceCount} evidence</text></g>; })}
  </svg>;
}

const DEFAULT_SERIES: TimeSeriesSeries[] = [
  {key:'soc',label:'SOC',unit:'%',stroke:'#60a5fa'},{key:'packTemp',label:'PACK TEMP',unit:'°C',stroke:'#f59e0b'},{key:'motorTemp',label:'MOTOR TEMP',unit:'°C',stroke:'#ef4444'},{key:'power',label:'POWER',unit:'kW',stroke:'#a78bfa'},{key:'tractiveForce',label:'TRACTIVE FORCE',unit:'kN',stroke:'#34d399'},{key:'speed',label:'SPEED',unit:'km/h',stroke:'#fbbf24'},{key:'ptoLoad',label:'PTO LOAD',unit:'kW',stroke:'#fb7185'},{key:'hydraulicLoad',label:'HYDRAULIC LOAD',unit:'%',stroke:'#2dd4bf'}
];
const FALLBACK_STROKES=['#60a5fa','#f59e0b','#ef4444','#a78bfa','#34d399','#fbbf24','#fb7185','#2dd4bf'];

export function MeasurementSeries({ points, events, series = DEFAULT_SERIES }: { points: TimeSeriesPoint[]; events: TestEvent[]; series?: TimeSeriesSeries[] }) {
  const [cursorIndex,setCursorIndex]=useState<number|null>(null); const width=960,left=146,right=24,top=18,rowH=46,graphW=width-left-right,height=top+series.length*rowH+28,maxT=points.at(-1)?.t??1;
  const ranges=useMemo(()=>Object.fromEntries(series.map(s=>{const values=points.map(p=>Number(p[s.key])).filter(Number.isFinite); const min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1; return [s.key,{min,max:max===min?min+1:max}];})),[points,series]);
  const xFor=(t:number)=>left+(t/maxT)*graphW;
  function inspect(clientX:number,target:SVGSVGElement){const rect=target.getBoundingClientRect(); const local=((clientX-rect.left)/rect.width)*width; const ratio=Math.max(0,Math.min(1,(local-left)/graphW)); setCursorIndex(Math.round(ratio*Math.max(0,points.length-1)));}
  const cursor=cursorIndex===null?null:points[cursorIndex]; const cursorText=cursor?series.slice(0,3).map(s=>`${s.label} ${Number(cursor[s.key]).toFixed(1)}${s.unit}`).join(' · '):'';
  return <div><div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-400"><span>SIMULATED FIXTURE DATA</span><span>•</span><span>Hover/tap plot for synchronized inspection</span>{cursor&&<span className="font-mono text-white">t={cursor.t}s · {cursorText}</span>}</div><svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-xl border border-white/10 bg-black/40 touch-none" role="img" aria-label={`Synchronized simulated time-series: ${series.map(s=>s.label).join(', ')}`} onPointerMove={e=>inspect(e.clientX,e.currentTarget)} onPointerDown={e=>inspect(e.clientX,e.currentTarget)} onPointerLeave={()=>setCursorIndex(null)}>
    {series.map((s,row)=>{const y0=top+row*rowH; const range=ranges[s.key] as {min:number;max:number}; const path=points.map((p,i)=>{const value=Number(p[s.key]); const finite=Number.isFinite(value)?value:range.min; const y=y0+rowH-9-((finite-range.min)/(range.max-range.min))*(rowH-18); return `${i===0?'M':'L'}${xFor(p.t).toFixed(1)},${y.toFixed(1)}`;}).join(' '); return <g key={s.key}><line x1={left} y1={y0+rowH} x2={width-right} y2={y0+rowH} stroke="#27272a"/><text x="12" y={y0+19} fill="#d4d4d8" fontSize="10" fontWeight="700">{s.label}</text><text x="12" y={y0+34} fill="#a1a1aa" fontSize="9">{range.min.toFixed(1)}–{range.max.toFixed(1)} {s.unit}</text><path d={path} fill="none" stroke={s.stroke??FALLBACK_STROKES[row%FALLBACK_STROKES.length]} strokeWidth="2" vectorEffect="non-scaling-stroke"/></g>;})}
    {events.map(e=><g key={e.id}><line x1={xFor(e.t)} y1={top} x2={xFor(e.t)} y2={height-28} stroke="#f4f4f5" strokeDasharray="4 4" opacity="0.45"/><text x={xFor(e.t)+4} y={height-12} fill="#a1a1aa" fontSize="8">{e.label}</text></g>)}{cursor&&<line x1={xFor(cursor.t)} y1={top} x2={xFor(cursor.t)} y2={height-28} stroke="#fff" strokeWidth="1" opacity="0.7"/>}
  </svg></div>;
}
