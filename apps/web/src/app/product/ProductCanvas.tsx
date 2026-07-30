'use client';

import { useRef, useState } from 'react';
import type { ProductGraph } from '@logichub-engineering/product-graph';

const CARD_W = 130;
const CARD_H = 62;

const TYPE_TONE: Record<string, string> = {
  battery: '#b45309',
  controller: '#1d4ed8',
  motor: '#047857',
  sensor: '#7c3aed',
  connectivity: '#0e7490',
  'operator-app': '#be123c',
};

const EDGE_TONE: Record<string, string> = {
  power: '#b45309',
  control: '#047857',
  data: '#0e7490',
  mechanical: '#57534e',
};

interface Props {
  graph: ProductGraph;
  selectedId: string | null;
  linkingFrom: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  errorNodeIds: Set<string>;
}

/**
 * The graph canvas. Nodes are dragged directly; a link is made by choosing a
 * source in the panel and tapping a target here.
 */
export function ProductCanvas({
  graph, selectedId, linkingFrom, onSelect, onMove, errorNodeIds,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);

  const position = (id: string) => graph.nodes.find(n => n.id === id)?.position;

  function toLocal(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }

  return (
    <svg
      ref={svgRef}
      className="w-full h-[420px] touch-none rounded-lg bg-neutral-50 dark:bg-neutral-900
                 border border-neutral-200 dark:border-neutral-800"
      onPointerMove={e => {
        if (dragging === null) return;
        const { x, y } = toLocal(e.clientX, e.clientY);
        onMove(dragging.id, Math.round(x - dragging.dx), Math.round(y - dragging.dy));
      }}
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
    >
      {graph.connections.map(connection => {
        const from = position(connection.from);
        const to = position(connection.to);
        if (from === undefined || to === undefined) return null;
        return (
          <line
            key={connection.id}
            x1={from.x + CARD_W / 2} y1={from.y + CARD_H / 2}
            x2={to.x + CARD_W / 2} y2={to.y + CARD_H / 2}
            stroke={EDGE_TONE[connection.type] ?? '#94a3b8'}
            strokeWidth={2}
            strokeDasharray={connection.type === 'data' ? '5 3' : undefined}
          />
        );
      })}

      {graph.nodes.map(node => {
        const selected = node.id === selectedId;
        const linking = node.id === linkingFrom;
        const failing = errorNodeIds.has(node.id);
        return (
          <g
            key={node.id}
            transform={`translate(${node.position.x}, ${node.position.y})`}
            onPointerDown={e => {
              e.preventDefault();
              onSelect(node.id);
              const { x, y } = toLocal(e.clientX, e.clientY);
              setDragging({ id: node.id, dx: x - node.position.x, dy: y - node.position.y });
            }}
            className="cursor-grab"
          >
            <rect
              width={CARD_W} height={CARD_H} rx={8}
              fill="var(--card-fill, #ffffff)"
              className="fill-white dark:fill-neutral-800"
              stroke={failing ? '#dc2626' : linking ? '#f59e0b' : selected ? '#0f172a' : '#cbd5e1'}
              strokeWidth={failing || selected || linking ? 2.5 : 1}
            />
            <rect width={5} height={CARD_H} rx={2} fill={TYPE_TONE[node.type] ?? '#64748b'} />
            <text x={14} y={22} className="fill-neutral-900 dark:fill-neutral-100"
                  fontSize={12} fontWeight={600}>
              {node.type}
            </text>
            <text x={14} y={40} className="fill-neutral-500 dark:fill-neutral-400" fontSize={10}>
              {summarise(node.derivedMetrics)}
            </text>
            {failing && (
              <text x={14} y={54} fill="#dc2626" fontSize={9}>
                {node.constraints.length} issue{node.constraints.length === 1 ? '' : 's'}
              </text>
            )}
          </g>
        );
      })}

      {graph.nodes.length === 0 && (
        <text x="50%" y="50%" textAnchor="middle"
              className="fill-neutral-400" fontSize={13}>
          Add a node to begin
        </text>
      )}
    </svg>
  );
}

/** One line of whatever the node actually resolved, or nothing if unresolved. */
function summarise(metrics: Record<string, number | string | boolean>): string {
  for (const key of ['nominalVoltageV', 'effectiveRpm', 'model', 'sensorType', 'connectivityType']) {
    const value = metrics[key];
    if (value === undefined) continue;
    const unit = key === 'nominalVoltageV' ? ' V' : key === 'effectiveRpm' ? ' rpm' : '';
    return `${String(value)}${unit}`;
  }
  return 'not resolved';
}
