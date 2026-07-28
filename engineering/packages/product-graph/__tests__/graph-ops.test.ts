import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  addNode,
  removeNode,
  connectNodes,
  disconnectNodes,
  updateNodeParameters,
  moveNode,
} from '../src/graph/graph-ops.js';
import { ProductGraphSchema } from '../src/schemas/product-graph.schema.js';

describe('Gate 1 — graph operations', () => {
  it('creates an empty graph that satisfies the schema', () => {
    const graph = createEmptyGraph();
    expect(ProductGraphSchema.safeParse(graph).success).toBe(true);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.connections).toHaveLength(0);
    expect(graph.userMode).toBe('explore');
  });

  it('adds a node seeded with its plugin defaults and category', () => {
    const graph = addNode(createEmptyGraph(), 'battery', { x: 10, y: 20 });
    expect(graph.nodes).toHaveLength(1);
    const [battery] = graph.nodes;
    expect(battery.type).toBe('battery');
    expect(battery.category).toBe('hardware');
    expect(battery.position).toEqual({ x: 10, y: 20 });
    expect(battery.parameters.chemistry).toBe('lipo');
  });

  it('rejects an unregistered node type', () => {
    expect(() => addNode(createEmptyGraph(), 'flux-capacitor', { x: 0, y: 0 }))
      .toThrow(/Unknown node type/);
  });

  it('leaves the original graph untouched when adding a node', () => {
    const before = createEmptyGraph();
    const after = addNode(before, 'motor', { x: 0, y: 0 });
    expect(before.nodes).toHaveLength(0);
    expect(after.nodes).toHaveLength(1);
  });

  it('connects two nodes and records the link on both', () => {
    let graph = addNode(createEmptyGraph(), 'battery', { x: 0, y: 0 });
    graph = addNode(graph, 'motor', { x: 100, y: 0 });
    const [battery, motor] = graph.nodes;

    graph = connectNodes(graph, battery.id, motor.id, 'power');

    expect(graph.connections).toHaveLength(1);
    expect(graph.connections[0]).toMatchObject({ from: battery.id, to: motor.id, type: 'power' });
    expect(graph.nodes[0].connectedNodes).toContain(motor.id);
    expect(graph.nodes[1].connectedNodes).toContain(battery.id);
  });

  it('rejects a self-loop', () => {
    let graph = addNode(createEmptyGraph(), 'battery', { x: 0, y: 0 });
    const [battery] = graph.nodes;
    expect(() => connectNodes(graph, battery.id, battery.id, 'power'))
      .toThrow(/self-loop/);
  });

  it('rejects a duplicate connection of the same type', () => {
    let graph = addNode(createEmptyGraph(), 'battery', { x: 0, y: 0 });
    graph = addNode(graph, 'motor', { x: 100, y: 0 });
    const [battery, motor] = graph.nodes;
    graph = connectNodes(graph, battery.id, motor.id, 'power');
    expect(() => connectNodes(graph, battery.id, motor.id, 'power'))
      .toThrow(/already exists/);
  });

  it('rejects a connection to a node that is not in the graph', () => {
    let graph = addNode(createEmptyGraph(), 'battery', { x: 0, y: 0 });
    const [battery] = graph.nodes;
    expect(() => connectNodes(graph, battery.id, 'missing', 'power'))
      .toThrow(/not found/);
  });

  it('removing a node cascades to every edge that touched it', () => {
    let graph = addNode(createEmptyGraph(), 'battery', { x: 0, y: 0 });
    graph = addNode(graph, 'controller', { x: 100, y: 0 });
    graph = addNode(graph, 'motor', { x: 200, y: 0 });
    const [battery, controller, motor] = graph.nodes;
    graph = connectNodes(graph, battery.id, controller.id, 'power');
    graph = connectNodes(graph, battery.id, motor.id, 'power');
    graph = connectNodes(graph, controller.id, motor.id, 'control');

    graph = removeNode(graph, battery.id);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.connections).toHaveLength(1);
    expect(graph.connections[0].type).toBe('control');
    for (const remaining of graph.nodes) {
      expect(remaining.connectedNodes).not.toContain(battery.id);
    }
  });

  it('removing an absent node is a no-op', () => {
    const graph = addNode(createEmptyGraph(), 'battery', { x: 0, y: 0 });
    expect(removeNode(graph, 'missing')).toBe(graph);
  });

  it('disconnects an edge and clears the adjacency it created', () => {
    let graph = addNode(createEmptyGraph(), 'battery', { x: 0, y: 0 });
    graph = addNode(graph, 'motor', { x: 100, y: 0 });
    const [battery, motor] = graph.nodes;
    graph = connectNodes(graph, battery.id, motor.id, 'power');

    graph = disconnectNodes(graph, graph.connections[0].id);

    expect(graph.connections).toHaveLength(0);
    expect(graph.nodes[0].connectedNodes).toHaveLength(0);
    expect(graph.nodes[1].connectedNodes).toHaveLength(0);
  });

  it('keeps adjacency when a second edge still joins the same pair', () => {
    let graph = addNode(createEmptyGraph(), 'controller', { x: 0, y: 0 });
    graph = addNode(graph, 'motor', { x: 100, y: 0 });
    const [controller, motor] = graph.nodes;
    graph = connectNodes(graph, controller.id, motor.id, 'control');
    graph = connectNodes(graph, controller.id, motor.id, 'power');

    graph = disconnectNodes(graph, graph.connections[0].id);

    expect(graph.connections).toHaveLength(1);
    expect(graph.nodes[0].connectedNodes).toContain(motor.id);
  });

  it('merges parameter updates without dropping untouched keys', () => {
    let graph = addNode(createEmptyGraph(), 'battery', { x: 0, y: 0 });
    const [battery] = graph.nodes;
    graph = updateNodeParameters(graph, battery.id, { cellCount: 4 });

    const updated = graph.nodes[0];
    expect(updated.parameters.cellCount).toBe(4);
    expect(updated.parameters.chemistry).toBe('lipo');
  });

  it('moves a node and rejects moving one that does not exist', () => {
    let graph = addNode(createEmptyGraph(), 'battery', { x: 0, y: 0 });
    const [battery] = graph.nodes;
    graph = moveNode(graph, battery.id, { x: 42, y: -7 });
    expect(graph.nodes[0].position).toEqual({ x: 42, y: -7 });
    expect(() => moveNode(graph, 'missing', { x: 0, y: 0 })).toThrow(/not found/);
  });
});
