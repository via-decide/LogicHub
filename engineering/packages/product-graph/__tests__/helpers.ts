import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';
import type {
  Connection,
  ConnectionType,
  LogicNode,
  ProductGraph,
  UserMode,
} from '../src/schemas/product-graph.schema.js';
import type { NodeContext } from '../src/nodes/node-plugin.js';
import { nodeRegistry } from '../src/nodes/node-registry.js';

/** Fixed timestamps keep serialized fixtures byte-stable across runs. */
const FIXED_TIME = '2026-01-01T00:00:00.000Z';

export function node(
  id: string,
  type: string,
  parameters: Record<string, unknown> = {},
): LogicNode {
  const plugin = nodeRegistry.require(type);
  return {
    id,
    type,
    category: plugin.category,
    parameters,
    capabilities: {},
    requirements: {},
    derivedMetrics: {},
    constraints: [],
    connectedNodes: [],
    position: { x: 0, y: 0 },
    maturity: 'concept',
  };
}

export function connection(id: string, from: string, to: string, type: ConnectionType): Connection {
  return { id, from, to, type };
}

export function graphOf(
  nodes: LogicNode[],
  connections: Connection[],
  userMode: UserMode = 'builder',
): ProductGraph {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'graph_test',
    name: 'Test Product',
    nodes,
    connections,
    userMode,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  };
}

export function bareContext(overrides: Partial<NodeContext> = {}): NodeContext {
  return {
    nodeId: 'n_test',
    graph: graphOf([], []),
    userMode: 'builder',
    upstream: {},
    upstreamNodes: [],
    downstreamNodes: [],
    transitiveDownstreamNodes: [],
    ...overrides,
  };
}

/**
 * The Motion Starter vertical slice.
 *
 * A 3-cell NiMH pack sits at 3.6 V, which is inside the ESP32's tolerated
 * input range and within 20% of the 3 V motor rating, so the slice exercises
 * every node world without tripping a supply-compatibility error.
 */
export function motionStarterGraph(userMode: UserMode = 'builder'): ProductGraph {
  const nodes = [
    node('n1_battery', 'battery', {
      chemistry: 'nimh', cellCount: 3, capacityMah: 2000, dischargeRating: 5,
    }),
    node('n2_controller', 'controller', {
      controller: 'esp32',
      assignedPins: { motorLeft: 'GPIO12', motorRight: 'GPIO13', echo: 'GPIO14', trig: 'GPIO15' },
    }),
    node('n3_motor_left', 'motor', {
      motorType: 'dc-brushed', ratedVoltageV: 3, noLoadRpm: 200,
      stallTorqueNcm: 8, stallCurrentA: 1.5, gearRatio: 1, wheelDiameterMm: 65,
    }),
    node('n4_motor_right', 'motor', {
      motorType: 'dc-brushed', ratedVoltageV: 3, noLoadRpm: 200,
      stallTorqueNcm: 8, stallCurrentA: 1.5, gearRatio: 1, wheelDiameterMm: 65,
    }),
    node('n5_sensor', 'sensor', {
      sensorType: 'distance', interfaceType: 'gpio', currentDrawMa: 15,
    }),
    node('n6_link', 'connectivity', { connectivityType: 'bluetooth', rangeMEstimate: 10 }),
    node('n7_app', 'operator-app', { appName: 'Rover' }),
  ];

  const connections = [
    connection('c1', 'n1_battery', 'n2_controller', 'power'),
    connection('c2', 'n1_battery', 'n3_motor_left', 'power'),
    connection('c3', 'n1_battery', 'n4_motor_right', 'power'),
    connection('c4', 'n2_controller', 'n3_motor_left', 'control'),
    connection('c5', 'n2_controller', 'n4_motor_right', 'control'),
    connection('c6', 'n1_battery', 'n5_sensor', 'power'),
    connection('c7', 'n2_controller', 'n5_sensor', 'data'),
    connection('c8', 'n2_controller', 'n6_link', 'data'),
    connection('c9', 'n6_link', 'n7_app', 'data'),
  ];

  return graphOf(nodes, connections, userMode);
}

export function findNode(graph: ProductGraph, id: string): LogicNode {
  const found = graph.nodes.find(n => n.id === id);
  if (!found) throw new Error(`Node ${id} not present in graph`);
  return found;
}
