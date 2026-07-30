'use client';

import { useState } from 'react';
import type { ConnectionType, UserMode } from '@logichub-engineering/product-graph';
import { useProductGraph } from './useProductGraph';
import { ProductCanvas } from './ProductCanvas';

const CONNECTION_TYPES: ConnectionType[] = ['power', 'control', 'data', 'mechanical'];
const MODES: UserMode[] = ['explore', 'builder', 'engineer'];

const VERDICT_TONE: Record<string, string> = {
  CAN_MAKE: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  ALMOST_POSSIBLE: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  NOT_RECOMMENDED: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
};

export default function ProductPage() {
  const {
    graph, violations, products, kits, selectedId, nodeTypes,
    add, remove, connect, setParameter, move, setMode, reset, setSelectedId,
  } = useProductGraph();

  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<ConnectionType>('power');

  const selected = graph.nodes.find(n => n.id === selectedId) ?? null;
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');
  const errorNodeIds = new Set(errors.map(v => v.nodeId));

  function handleSelect(id: string) {
    if (linkingFrom !== null && linkingFrom !== id) {
      connect(linkingFrom, id, linkType);
      setLinkingFrom(null);
      return;
    }
    setSelectedId(id);
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Product Builder</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Everything here runs in your browser. The graph is held on this device and is
          not sent anywhere.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 items-center">
        {nodeTypes.map(type => (
          <button
            key={type}
            onClick={() => add(type)}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5
                       text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            + {type}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
        <select
          value={graph.userMode}
          onChange={e => setMode(e.target.value as UserMode)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700
                     bg-transparent px-2 py-1.5 text-sm"
        >
          {MODES.map(mode => <option key={mode} value={mode}>{mode} mode</option>)}
        </select>
        <button
          onClick={reset}
          className="rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-900
                     dark:hover:text-neutral-100"
        >
          Reset
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <ProductCanvas
          graph={graph}
          selectedId={selectedId}
          linkingFrom={linkingFrom}
          onSelect={handleSelect}
          onMove={move}
          errorNodeIds={errorNodeIds}
        />

        <aside className="space-y-4">
          {selected === null ? (
            <Panel title="Node">
              <p className="text-sm text-neutral-500">Select a node to edit it.</p>
            </Panel>
          ) : (
            <Panel title={selected.type}>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={linkType}
                    onChange={e => setLinkType(e.target.value as ConnectionType)}
                    className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700
                               bg-transparent px-2 py-1 text-xs"
                  >
                    {CONNECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button
                    onClick={() => setLinkingFrom(linkingFrom === selected.id ? null : selected.id)}
                    className="rounded-md border border-neutral-300 dark:border-neutral-700
                               px-2 py-1 text-xs"
                  >
                    {linkingFrom === selected.id ? 'Cancel' : 'Link from'}
                  </button>
                  <button
                    onClick={() => remove(selected.id)}
                    className="rounded-md px-2 py-1 text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>

                {Object.keys(selected.parameters).sort().map(key => (
                  <ParameterField
                    key={key}
                    name={key}
                    value={selected.parameters[key]}
                    onChange={value => setParameter(selected.id, key, value)}
                  />
                ))}

                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <h3 className="text-xs font-medium text-neutral-500 mb-1">Derived</h3>
                  <dl className="text-xs space-y-0.5">
                    {Object.keys(selected.derivedMetrics).sort().map(key => (
                      <div key={key} className="flex justify-between gap-2">
                        <dt className="text-neutral-500 truncate">{key}</dt>
                        <dd className="font-mono">{String(selected.derivedMetrics[key])}</dd>
                      </div>
                    ))}
                  </dl>
                  {Object.keys(selected.derivedMetrics).length === 0 && (
                    <p className="text-xs text-neutral-400">Nothing resolved yet.</p>
                  )}
                </div>
              </div>
            </Panel>
          )}

          <Panel title={`Issues (${errors.length} error, ${warnings.length} warning)`}>
            {violations.length === 0 ? (
              <p className="text-xs text-neutral-500">
                No constraint is currently violated. That is not a statement that this design
                has been validated against hardware.
              </p>
            ) : (
              <ul className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
                {violations.map((v, i) => (
                  <li key={`${v.nodeId}-${v.code}-${i}`} className="flex gap-1.5">
                    <span className={v.severity === 'error' ? 'text-red-600' : 'text-amber-600'}>
                      ●
                    </span>
                    <span>
                      <span className="font-mono text-[11px]">{v.code}</span>
                      <span className="block text-neutral-500">{v.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="What this could become">
          <ul className="space-y-1.5">
            {products.slice(0, 6).map(match => (
              <li key={match.templateId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{match.templateName}</span>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium
                                  ${VERDICT_TONE[match.verdict]}`}>
                  {match.verdict.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Matching kits">
          <ul className="space-y-1.5">
            {kits.slice(0, 4).map(kit => (
              <li key={kit.kitId} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{kit.kitName}</span>
                  <span className="shrink-0 font-mono text-xs">{kit.matchPercentage}%</span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  {kit.validationStatus.toLowerCase()} · no component sourced · not purchasable
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <footer className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
        Figures shown are calculated or estimated from component data. Nothing here has been
        built, measured, sourced, or certified.
      </footer>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ParameterField({
  name, value, onChange,
}: { name: string; value: unknown; onChange: (value: unknown) => void }) {
  if (typeof value === 'object' && value !== null) return null;

  const isNumber = typeof value === 'number';
  return (
    <label className="block">
      <span className="text-xs text-neutral-500">{name}</span>
      <input
        type={isNumber ? 'number' : 'text'}
        value={String(value ?? '')}
        step="any"
        onChange={e => {
          const raw = e.target.value;
          onChange(isNumber ? (raw === '' ? 0 : Number(raw)) : raw);
        }}
        className="mt-0.5 w-full rounded-md border border-neutral-300 dark:border-neutral-700
                   bg-transparent px-2 py-1 text-sm"
      />
    </label>
  );
}
