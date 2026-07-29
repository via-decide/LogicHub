import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';
import {
  nodeRegistry,
  type Connection,
  type ConnectionType,
  type LogicNode,
  type ProductGraph,
} from '@logichub-engineering/product-graph';
import type { ProductIntent, RevisionStamp } from '../src/schemas/revision.schema.js';

export const FIXED_TIME = '2026-04-01T09:00:00.000Z';

export const INTENT: ProductIntent = {
  statement: 'A two-motor rover driven from a phone.',
  targetProductTemplateIds: ['bluetooth-rover'],
  notes: '',
};

export const STAMP: RevisionStamp = {
  hardware: 'hw-a',
  firmware: 'fw-1.0.0',
  application: 'app-1.0.0',
  enclosure: 'enc-none',
};

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

/**
 * A rover on a 3-cell LiPo pack. Cell count is the parameter the spec's
 * worked example changes, so the fixture is built around it.
 */
export function roverGraph(cellCount = 3, motorRatedVoltageV = 12): ProductGraph {
  const nodes = [
    node('n1_battery', 'battery', {
      chemistry: 'lipo', cellCount, capacityMah: 2200, dischargeRating: 5,
    }),
    node('n2_controller', 'controller', {
      controller: 'esp32', supplyEntry: 'board-vin',
    }),
    node('n3_motor_left', 'motor', { ratedVoltageV: motorRatedVoltageV, noLoadRpm: 200 }),
    node('n4_motor_right', 'motor', { ratedVoltageV: motorRatedVoltageV, noLoadRpm: 200 }),
    node('n5_link', 'connectivity', { connectivityType: 'bluetooth' }),
    node('n6_app', 'operator-app', { appName: 'Rover' }),
  ];

  const connections = [
    connection('c1', 'n1_battery', 'n2_controller', 'power'),
    connection('c2', 'n1_battery', 'n3_motor_left', 'power'),
    connection('c3', 'n1_battery', 'n4_motor_right', 'power'),
    connection('c4', 'n2_controller', 'n3_motor_left', 'control'),
    connection('c5', 'n2_controller', 'n4_motor_right', 'control'),
    connection('c6', 'n2_controller', 'n5_link', 'data'),
    connection('c7', 'n5_link', 'n6_app', 'data'),
  ];

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'graph_repo_test',
    name: 'Test Rover',
    nodes,
    connections,
    userMode: 'builder',
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  };
}
