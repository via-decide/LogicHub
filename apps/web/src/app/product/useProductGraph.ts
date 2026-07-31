'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addNode,
  connectNodes,
  createEmptyGraph,
  deserializeGraph,
  matchProducts,
  moveNode,
  nodeRegistry,
  propagate,
  removeNode,
  serializeGraph,
  updateNodeParameters,
  type ConnectionType,
  type MatchResult,
  type ProductGraph,
  type PropagationViolation,
  type UserMode,
} from '@logichub-engineering/product-graph';
import { matchKits, type KitMatch } from '@logichub-engineering/kit-matching';

const STORAGE_KEY = 'logichub.product-graph.v1';

export interface ProductGraphState {
  graph: ProductGraph;
  violations: PropagationViolation[];
  products: MatchResult[];
  kits: KitMatch[];
  selectedId: string | null;
  nodeTypes: string[];
}

/**
 * Everything the canvas needs, computed locally.
 *
 * The graph never leaves the browser: it is held in React state, persisted to
 * localStorage, and every derived figure comes from the engine running here.
 * Nothing on this page makes a network call.
 */
export function useProductGraph() {
  const [graph, setGraph] = useState<ProductGraph>(() => createEmptyGraph());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore after mount so server and client render the same empty graph first.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setGraph(deserializeGraph(saved));
    } catch {
      // A corrupt or outdated save is discarded rather than crashing the page.
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    window.localStorage.setItem(STORAGE_KEY, serializeGraph(graph));
  }, [graph, restored]);

  const resolved = useMemo(() => propagate(graph), [graph]);
  const products = useMemo(() => matchProducts(resolved.graph), [resolved.graph]);
  const kits = useMemo(() => matchKits(resolved.graph), [resolved.graph]);

  const nodeTypes = useMemo(() => nodeRegistry.types(), []);

  const add = useCallback((nodeType: string) => {
    setGraph(current => {
      // Three columns keeps new nodes inside the canvas on a narrow viewport.
      const column = current.nodes.length % 3;
      const row = Math.floor(current.nodes.length / 3);
      return addNode(current, nodeType, { x: 20 + column * 152, y: 24 + row * 86 });
    });
  }, []);

  const remove = useCallback((nodeId: string) => {
    setGraph(current => removeNode(current, nodeId));
    setSelectedId(current => (current === nodeId ? null : current));
  }, []);

  const connect = useCallback((from: string, to: string, type: ConnectionType) => {
    setGraph(current => {
      try {
        return connectNodes(current, from, to, type);
      } catch {
        // Invalid links (self-loops, duplicates) are simply not made.
        return current;
      }
    });
  }, []);

  const setParameter = useCallback((nodeId: string, key: string, value: unknown) => {
    setGraph(current => updateNodeParameters(current, nodeId, { [key]: value }));
  }, []);

  const move = useCallback((nodeId: string, x: number, y: number) => {
    setGraph(current => moveNode(current, nodeId, { x, y }));
  }, []);

  const setMode = useCallback((userMode: UserMode) => {
    setGraph(current => ({ ...current, userMode }));
  }, []);

  const reset = useCallback(() => {
    setGraph(createEmptyGraph());
    setSelectedId(null);
  }, []);

  const state: ProductGraphState = {
    graph: resolved.graph,
    violations: resolved.violations,
    products,
    kits,
    selectedId,
    nodeTypes,
  };

  return { ...state, add, remove, connect, setParameter, move, setMode, reset, setSelectedId };
}
