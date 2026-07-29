import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';
import {
  nodeRegistry,
  propagate,
  type Connection,
  type ConnectionType,
  type LogicNode,
  type ProductGraph,
} from '@logichub-engineering/product-graph';

const FIXED_TIME = '2026-01-01T00:00:00.000Z';

function node(id: string, type: string, parameters: Record<string, unknown> = {}): LogicNode {
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

function connection(id: string, from: string, to: string, type: ConnectionType): Connection {
  return { id, from, to, type };
}

/** The Motion Starter slice, propagated. */
export function roverGraph(): ProductGraph {
  const nodes = [
    node('n1_battery', 'battery', {
      chemistry: 'nimh', cellCount: 3, capacityMah: 2000, dischargeRating: 5,
    }),
    node('n2_controller', 'controller', {
      controller: 'esp32',
      assignedPins: { motorLeft: 'GPIO12', motorRight: 'GPIO13' },
    }),
    node('n3_motor_left', 'motor', { ratedVoltageV: 3, noLoadRpm: 200 }),
    node('n4_motor_right', 'motor', { ratedVoltageV: 3, noLoadRpm: 200 }),
    node('n5_sensor', 'sensor', { sensorType: 'distance' }),
    node('n6_link', 'connectivity', { connectivityType: 'bluetooth' }),
    node('n7_app', 'operator-app', { appName: 'Rover' }),
  ];

  const connections = [
    connection('c1', 'n1_battery', 'n2_controller', 'power'),
    connection('c2', 'n1_battery', 'n3_motor_left', 'power'),
    connection('c3', 'n1_battery', 'n4_motor_right', 'power'),
    connection('c4', 'n2_controller', 'n3_motor_left', 'control'),
    connection('c5', 'n2_controller', 'n4_motor_right', 'control'),
    connection('c6', 'n1_battery', 'n5_sensor', 'power'),
    connection('c7', 'n2_controller', 'n6_link', 'data'),
    connection('c8', 'n6_link', 'n7_app', 'data'),
  ];

  return propagate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'graph_capsule_test',
    name: 'Test Rover',
    nodes,
    connections,
    userMode: 'builder',
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  }).graph;
}
