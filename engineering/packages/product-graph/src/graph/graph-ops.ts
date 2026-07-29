import type { ProductGraph, LogicNode, Connection, ConnectionType, Position } from '../schemas/product-graph.schema.js';
import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';
import { nodeRegistry } from '../nodes/node-registry.js';

let counter = 0;
function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;
}

export function createEmptyGraph(): ProductGraph {
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: generateId('graph'),
    name: 'Untitled Product',
    nodes: [],
    connections: [],
    userMode: 'explore',
    createdAt: now,
    updatedAt: now,
  };
}

export function addNode(
  graph: ProductGraph,
  nodeType: string,
  position: Position,
): ProductGraph {
  const plugin = nodeRegistry.require(nodeType);
  const node: LogicNode = {
    id: generateId('node'),
    type: nodeType,
    category: plugin.category,
    parameters: { ...(plugin.defaultParameters as Record<string, unknown>) },
    capabilities: {},
    requirements: {},
    derivedMetrics: {},
    constraints: [],
    connectedNodes: [],
    position,
    maturity: 'concept',
  };
  return {
    ...graph,
    nodes: [...graph.nodes, node],
    updatedAt: new Date().toISOString(),
  };
}

export function removeNode(graph: ProductGraph, nodeId: string): ProductGraph {
  const nodeExists = graph.nodes.some(n => n.id === nodeId);
  if (!nodeExists) return graph;

  return {
    ...graph,
    nodes: graph.nodes
      .filter(n => n.id !== nodeId)
      .map(n => ({
        ...n,
        connectedNodes: n.connectedNodes.filter(id => id !== nodeId),
      })),
    connections: graph.connections.filter(c => c.from !== nodeId && c.to !== nodeId),
    updatedAt: new Date().toISOString(),
  };
}

export function connectNodes(
  graph: ProductGraph,
  fromId: string,
  toId: string,
  type: ConnectionType,
): ProductGraph {
  if (fromId === toId) {
    throw new Error('Cannot create self-loop connection');
  }

  const fromNode = graph.nodes.find(n => n.id === fromId);
  const toNode = graph.nodes.find(n => n.id === toId);
  if (!fromNode || !toNode) {
    throw new Error('Source or target node not found');
  }

  const duplicate = graph.connections.some(
    c => c.from === fromId && c.to === toId && c.type === type,
  );
  if (duplicate) {
    throw new Error('Connection already exists');
  }

  const connection: Connection = {
    id: generateId('conn'),
    from: fromId,
    to: toId,
    type,
  };

  return {
    ...graph,
    connections: [...graph.connections, connection],
    nodes: graph.nodes.map(n => {
      if (n.id === fromId && !n.connectedNodes.includes(toId)) {
        return { ...n, connectedNodes: [...n.connectedNodes, toId] };
      }
      if (n.id === toId && !n.connectedNodes.includes(fromId)) {
        return { ...n, connectedNodes: [...n.connectedNodes, fromId] };
      }
      return n;
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function disconnectNodes(graph: ProductGraph, connectionId: string): ProductGraph {
  const conn = graph.connections.find(c => c.id === connectionId);
  if (!conn) return graph;

  const remainingConnections = graph.connections.filter(c => c.id !== connectionId);

  return {
    ...graph,
    connections: remainingConnections,
    nodes: graph.nodes.map(n => {
      if (n.id === conn.from || n.id === conn.to) {
        const otherId = n.id === conn.from ? conn.to : conn.from;
        const stillConnected = remainingConnections.some(
          c => (c.from === n.id && c.to === otherId) || (c.to === n.id && c.from === otherId),
        );
        if (!stillConnected) {
          return { ...n, connectedNodes: n.connectedNodes.filter(id => id !== otherId) };
        }
      }
      return n;
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function updateNodeParameters(
  graph: ProductGraph,
  nodeId: string,
  params: Record<string, unknown>,
): ProductGraph {
  const nodeExists = graph.nodes.some(n => n.id === nodeId);
  if (!nodeExists) {
    throw new Error('Node not found');
  }

  return {
    ...graph,
    nodes: graph.nodes.map(n =>
      n.id === nodeId ? { ...n, parameters: { ...n.parameters, ...params } } : n,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function moveNode(graph: ProductGraph, nodeId: string, position: Position): ProductGraph {
  const nodeExists = graph.nodes.some(n => n.id === nodeId);
  if (!nodeExists) {
    throw new Error('Node not found');
  }

  return {
    ...graph,
    nodes: graph.nodes.map(n =>
      n.id === nodeId ? { ...n, position } : n,
    ),
    updatedAt: new Date().toISOString(),
  };
}
