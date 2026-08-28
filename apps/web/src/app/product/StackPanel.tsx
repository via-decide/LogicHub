'use client';

import { useMemo } from 'react';
import type { ProductGraph } from '@logichub-engineering/product-graph';
import { aggregateCapabilities } from '@logichub-engineering/product-graph';
import { generateAllSurfaces } from '@logichub-engineering/generated-surfaces';

/**
 * "Generate stack" over the graph already on this page, reusing the same
 * surface generators Gate 5 already built (operator/engineering/service),
 * rather than inventing a second dashboard-schema format alongside them.
 *
 * This deliberately does not use project-capsule's `buildCapsule`: its
 * hashing runs on `node:crypto`, which has no browser equivalent, and this
 * page's whole design is that the graph never leaves the browser. Wiring a
 * full capsule export in here would mean either sending the graph to a
 * server (breaking that guarantee) or replacing project-capsule's hash
 * primitive with a Web Crypto build — which is also what `physical-ci`'s
 * content-addressed telemetry relies on, so that's a change worth making on
 * its own, not as a side effect of this panel.
 */
export function StackPanel({ graph }: { graph: ProductGraph }) {
  const surfaces = useMemo(() => generateAllSurfaces(graph), [graph]);

  const chipset = useMemo(() => {
    const controller = graph.nodes.find(n => n.type === 'controller');
    const model = controller?.derivedMetrics.model;
    return typeof model === 'string' ? model : null;
  }, [graph]);

  const telemetryChannels = useMemo(
    () => surfaces.operator.sections.flatMap(s => s.readouts),
    [surfaces],
  );

  const protocols = useMemo(() => {
    const caps = aggregateCapabilities(graph);
    return Object.keys(caps).filter(key => caps[key] === true).sort();
  }, [graph]);

  function handleDownload() {
    const bundle = {
      graphId: graph.id,
      graphName: graph.name,
      generatedFrom: 'this graph, in your browser — not verified against hardware',
      surfaces,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.id}-stack.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        Hardware schema
      </h2>

      <dl className="text-xs space-y-1">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Chipset</dt>
          <dd className="font-mono">{chipset ?? 'none selected'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Telemetry channels</dt>
          <dd className="font-mono">{telemetryChannels.length}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Protocols</dt>
          <dd className="font-mono text-right">{protocols.length > 0 ? protocols.join(', ') : 'none'}</dd>
        </div>
      </dl>

      <button
        onClick={handleDownload}
        className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5
                   text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        Download config
      </button>

      <p className="text-[11px] text-neutral-500 leading-relaxed">
        Generated entirely in your browser from the graph above, the same way the rest of
        this page works. Nothing here has been built, measured, sourced, or certified.
      </p>
    </section>
  );
}
