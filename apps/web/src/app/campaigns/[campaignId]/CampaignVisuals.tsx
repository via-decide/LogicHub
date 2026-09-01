'use client';

import { useMemo, useState } from 'react';
import type { Dependency, TestEvent, TimeSeriesPoint } from '@/lib/campaign/contracts';

const STATUS_STYLE: Record<string, string> = {
  SUPPORTED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  PASS: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  REVIEWED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  REPLICATED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  EXTERNALLY_VERIFIED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  CONDITIONALLY_SUPPORTED: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  CONDITIONAL: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  WARNING: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  FAIL: 'border-red-500/40 bg-red-500/10 text-red-300',
  FAILED: 'border-red-500/40 bg-red-500/10 text-red-300',
  BLOCKED: 'border-red-500/40 bg-red-500/10 text-red-300',
  STALE: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
  INVALIDATED: 'border-red-500/40 bg-red-500/10 text-red-300',
  REVIEW_REQUIRED: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
  INCONCLUSIVE: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  UNTESTED: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  TESTING: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  READY: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  RUNNING: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  PRESENT: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
};

const STATUS_ICON: Record<string, string> = {
  SUPPORTED: '✓', PASS: '✓', REVIEWED: '✓', REPLICATED: '✓', EXTERNALLY_VERIFIED: '✓',
  CONDITIONALLY_SUPPORTED: '⚠', CONDITIONAL: '⚠', WARNING: '⚠',
  FAIL: '✕', FAILED: '✕', BLOCKED: '✕', INVALIDATED: '✕',
  STALE: '↻', REVIEW_REQUIRED: '↻', INCONCLUSIVE: '?', UNTESTED: '—',
  TESTING: '•', READY: '•', RUNNING: '•', PRESENT: '•',
};

export function StatusBadge({ state, compact = false }: { state: string; compact?: boolean }) {
  const style = STATUS_STYLE[state] ?? 'border-zinc-600 bg-zinc-900 text-zinc-300';
  return (
    <span className={`inline-flex items-center gap-1 rounded border font-mono font-bold uppercase tracking-wide ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} ${style}`}>
      <span aria-hidden="true">{STATUS_ICON[state] ?? '•'}</span><span>{state.replaceAll('_', ' ')}</span>
    </span>
  );
}

interface AggregatedDependency extends Dependency {
  status: string;
  testCount: number;
  completedTestCount: number;
  evidenceCount: number;
  coveragePct: number;
}

export function DependencyGraph({ dependencies, selectedId, onSelect }: { dependencies: AggregatedDependency[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const positions = [
    [55, 36], [285, 36], [515, 36],
    [55, 156], [515, 156],
    [55, 276], [285, 276], [515, 276], [285, 386],
  ];
  const root = { x: 285, y: 156, w: 170, h: 78 };

  return (
    <div>
      <svg viewBox="0 0 740 490" className="w-full rounded-xl border border-white/10 bg-black/30" role="group" aria-label="Claim dependency graph">
        {dependencies.map((dependency, index) => {
          const [x, y] = positions[index] ?? [55, 386];
          return <line key={`edge-${dependency.id}`} x1={root.x + root.w / 2} y1={root.y + root.h / 2} x2={x + 75} y2={y + 38} stroke="#3f3f46" strokeWidth="1.5" />;
        })}
        <rect x={root.x} y={root.y} width={root.w} height={root.h} rx="10" fill="#18181b" stroke="#60a5fa" strokeWidth="2" />
        <text x={root.x + 14} y={root.y + 26} fill="#93c5fd" fontSize="12" fontWeight="700">CLAIM</text>
        <text x={root.x + 14} y={root.y + 47} fill="#f4f4f5" fontSize="12">Defined duty</text>
        <text x={root.x + 14} y={root.y + 64} fill="#a1a1aa" fontSize="10">tractor replacement</text>
        {dependencies.map((dependency, index) => {
          const [x, y] = positions[index] ?? [55, 386];
          const selected = selectedId === dependency.id;
          const stroke = dependency.status === 'FAILED' ? '#ef4444' : dependency.status === 'SUPPORTED' ? '#22c55e' : dependency.status === 'CONDITIONAL' ? '#f59e0b' : '#71717a';
          return (
            <g key={dependency.id} role="button" tabIndex={0} aria-label={`${dependency.name}, ${dependency.status}, ${dependency.coveragePct}% test coverage`} className="cursor-pointer outline-none" onClick={() => onSelect(dependency.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(dependency.id); }}>
              <rect x={x} y={y} width="150" height="76" rx="9" fill={selected ? '#27272a' : '#18181b'} stroke={stroke} strokeWidth={selected ? 3 : 1.5} />
              <text x={x + 12} y={y + 23} fill="#f4f4f5" fontSize="12" fontWeight="700">{dependency.name.toUpperCase()}</text>
              <text x={x + 12} y={y + 43} fill={stroke} fontSize="10" fontWeight="700">{dependency.status}</text>
              <text x={x + 12} y={y + 60} fill="#a1a1aa" fontSize="9">{dependency.completedTestCount}/{dependency.testCount} tests · {dependency.evidenceCount} evidence</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const SERIES: Array<{ key: keyof TimeSeriesPoint; label: string; unit: string; stroke: string }> = [
  { key: 'soc', label: 'SOC', unit: '%', stroke: '#60a5fa' },
  { key: 'packTemp', label: 'PACK TEMP', unit: '°C', stroke: '#f59e0b' },
  { key: 'motorTemp', label: 'MOTOR TEMP', unit: '°C', stroke: '#ef4444' },
  { key: 'power', label: 'POWER', unit: 'kW', stroke: '#a78bfa' },
  { key: 'tractiveForce', label: 'TRACTIVE FORCE', unit: 'kN', stroke: '#34d399' },
  { key: 'speed', label: 'SPEED', unit: 'km/h', stroke: '#fbbf24' },
  { key: 'ptoLoad', label: 'PTO LOAD', unit: 'kW', stroke: '#fb7185' },
  { key: 'hydraulicLoad', label: 'HYDRAULIC LOAD', unit: '%', stroke: '#2dd4bf' },
];

export function MeasurementSeries({ points, events }: { points: TimeSeriesPoint[]; events: TestEvent[] }) {
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const width = 960;
  const left = 126;
  const right = 24;
  const top = 18;
  const rowH = 46;
  const graphW = width - left - right;
  const height = top + SERIES.length * rowH + 28;
  const maxT = points.at(-1)?.t ?? 1;

  const ranges = useMemo(() => Object.fromEntries(SERIES.map((series) => {
    const values = points.map((point) => Number(point[series.key]));
    const min = Math.min(...values);
    const max = Math.max(...values);
    return [series.key, { min, max: max === min ? min + 1 : max }];
  })), [points]);

  function xFor(t: number) { return left + (t / maxT) * graphW; }
  function inspect(clientX: number, currentTarget: SVGSVGElement) {
    const rect = currentTarget.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * width;
    const ratio = Math.max(0, Math.min(1, (localX - left) / graphW));
    setCursorIndex(Math.round(ratio * Math.max(0, points.length - 1)));
  }

  const cursor = cursorIndex === null ? null : points[cursorIndex];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-400">
        <span>SIMULATED FIXTURE DATA</span><span>•</span><span>Hover/tap plot for synchronized inspection</span>
        {cursor && <span className="font-mono text-white">t={cursor.t}s · SOC {cursor.soc.toFixed(1)}% · pack {cursor.packTemp.toFixed(1)}°C · motor {cursor.motorTemp.toFixed(1)}°C</span>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-xl border border-white/10 bg-black/40 touch-none" role="img" aria-label="Synchronized simulated time-series for SOC, temperatures, power, force, speed, PTO and hydraulic load" onPointerMove={(event) => inspect(event.clientX, event.currentTarget)} onPointerDown={(event) => inspect(event.clientX, event.currentTarget)} onPointerLeave={() => setCursorIndex(null)}>
        {SERIES.map((series, row) => {
          const y0 = top + row * rowH;
          const range = ranges[series.key] as { min: number; max: number };
          const path = points.map((point, index) => {
            const x = xFor(point.t);
            const value = Number(point[series.key]);
            const y = y0 + rowH - 9 - ((value - range.min) / (range.max - range.min)) * (rowH - 18);
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(' ');
          return (
            <g key={String(series.key)}>
              <line x1={left} y1={y0 + rowH} x2={width - right} y2={y0 + rowH} stroke="#27272a" />
              <text x="12" y={y0 + 19} fill="#d4d4d8" fontSize="10" fontWeight="700">{series.label}</text>
              <text x="12" y={y0 + 34} fill="#71717a" fontSize="9">{range.min.toFixed(1)}–{range.max.toFixed(1)} {series.unit}</text>
              <path d={path} fill="none" stroke={series.stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {events.map((event) => <g key={event.id}><line x1={xFor(event.t)} y1={top} x2={xFor(event.t)} y2={height - 28} stroke="#f4f4f5" strokeDasharray="4 4" opacity="0.45" /><text x={xFor(event.t) + 4} y={height - 12} fill="#a1a1aa" fontSize="8">{event.label}</text></g>)}
        {cursor && <line x1={xFor(cursor.t)} y1={top} x2={xFor(cursor.t)} y2={height - 28} stroke="#ffffff" strokeWidth="1" opacity="0.7" />}
      </svg>
    </div>
  );
}
