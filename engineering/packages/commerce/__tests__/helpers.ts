import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';
import {
  nodeRegistry,
  propagate,
  type Connection,
  type ConnectionType,
  type LogicNode,
  type ProductGraph,
} from '@logichub-engineering/product-graph';

export const FIXED_TIME = '2026-05-01T09:00:00.000Z';

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

function graphOf(id: string, nodes: LogicNode[], connections: Connection[]): ProductGraph {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    name: 'Rover',
    nodes,
    connections,
    userMode: 'builder',
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  };
}

/** The Motion Starter slice, propagated. */
export function roverGraph(): ProductGraph {
  return propagate(graphOf('graph_commerce_test', [
    node('n1_battery', 'battery', {
      chemistry: 'nimh', cellCount: 3, capacityMah: 2000, dischargeRating: 5,
    }),
    node('n2_controller', 'controller', {
      controller: 'esp32', assignedPins: { motorLeft: 'GPIO12', motorRight: 'GPIO13' },
    }),
    node('n3_motor_left', 'motor', { ratedVoltageV: 3, noLoadRpm: 200 }),
    node('n4_motor_right', 'motor', { ratedVoltageV: 3, noLoadRpm: 200 }),
    node('n5_sensor', 'sensor', { sensorType: 'distance' }),
    node('n6_link', 'connectivity', { connectivityType: 'bluetooth' }),
    node('n7_app', 'operator-app', { appName: 'Rover' }),
  ], [
    connection('c1', 'n1_battery', 'n2_controller', 'power'),
    connection('c2', 'n1_battery', 'n3_motor_left', 'power'),
    connection('c3', 'n1_battery', 'n4_motor_right', 'power'),
    connection('c4', 'n2_controller', 'n3_motor_left', 'control'),
    connection('c5', 'n2_controller', 'n4_motor_right', 'control'),
    connection('c6', 'n1_battery', 'n5_sensor', 'power'),
    connection('c7', 'n2_controller', 'n6_link', 'data'),
    connection('c8', 'n6_link', 'n7_app', 'data'),
  ])).graph;
}

/**
 * The same capabilities reached a different way: different node ids, different
 * ordering, different pack size and pin names. A challenge signature must
 * treat this as the same solution.
 */
export function equivalentRoverGraph(): ProductGraph {
  return propagate(graphOf('graph_someone_else', [
    node('z9_link', 'connectivity', { connectivityType: 'bluetooth' }),
    node('z8_app', 'operator-app', { appName: 'My Build' }),
    node('z1_pack', 'battery', {
      chemistry: 'nimh', cellCount: 3, capacityMah: 3000, dischargeRating: 5,
    }),
    node('z2_mcu', 'controller', {
      controller: 'esp32', assignedPins: { left: 'GPIO25', right: 'GPIO26' },
    }),
    node('z3_drive_a', 'motor', { ratedVoltageV: 3, noLoadRpm: 240 }),
    node('z4_drive_b', 'motor', { ratedVoltageV: 3, noLoadRpm: 240 }),
    node('z5_range', 'sensor', { sensorType: 'distance' }),
  ], [
    connection('k1', 'z1_pack', 'z2_mcu', 'power'),
    connection('k2', 'z1_pack', 'z3_drive_a', 'power'),
    connection('k3', 'z1_pack', 'z4_drive_b', 'power'),
    connection('k4', 'z2_mcu', 'z3_drive_a', 'control'),
    connection('k5', 'z2_mcu', 'z4_drive_b', 'control'),
    connection('k6', 'z1_pack', 'z5_range', 'power'),
    connection('k7', 'z2_mcu', 'z9_link', 'data'),
    connection('k8', 'z9_link', 'z8_app', 'data'),
  ])).graph;
}

/** A materially different product: no motion at all. */
export function monitorGraph(): ProductGraph {
  return propagate(graphOf('graph_monitor', [
    node('m1_battery', 'battery', {
      chemistry: 'nimh', cellCount: 3, capacityMah: 2000, dischargeRating: 5,
    }),
    node('m2_controller', 'controller', { controller: 'esp32' }),
    node('m3_sensor', 'sensor', { sensorType: 'temperature' }),
  ], [
    connection('j1', 'm1_battery', 'm2_controller', 'power'),
    connection('j2', 'm2_controller', 'm3_sensor', 'data'),
  ])).graph;
}
