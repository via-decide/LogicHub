import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';
import type {
  Connection,
  LogicNode,
  ProductGraph,
  UserMode,
} from '@logichub-engineering/product-graph';
import { nodeRegistry } from '@logichub-engineering/product-graph';
import { requireComponent } from '../catalogue/components.js';
import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

/**
 * Parameters each catalogue component maps to when it becomes a graph node.
 *
 * These are the component's nominal figures. They are a starting point the
 * user is expected to edit — loading a kit produces an ordinary graph with no
 * special status, which is what makes a kit editable rather than fixed.
 */
const COMPONENT_PARAMETERS: Record<string, Record<string, unknown>> = {
  'controller-esp32': { controller: 'esp32', supplyEntry: 'board-vin' },
  'controller-rp2040': { controller: 'rp2040', supplyEntry: 'board-vin' },
  'controller-rp2350': { controller: 'rp2350', supplyEntry: 'board-vin' },
  'controller-esp32-camera': { controller: 'esp32', supplyEntry: 'board-vin' },

  'motor-dc-gearbox': {
    motorType: 'dc-brushed', ratedVoltageV: 6, noLoadRpm: 200,
    stallTorqueNcm: 8, stallCurrentA: 1.5, gearRatio: 1, wheelDiameterMm: 65,
  },
  'actuator-micro-servo': {
    motorType: 'servo', ratedVoltageV: 5, noLoadRpm: 60,
    stallTorqueNcm: 15, stallCurrentA: 0.25, gearRatio: 1, wheelDiameterMm: 20,
  },

  'battery-holder-3xaa': {
    chemistry: 'nimh', cellCount: 3, capacityMah: 2000, dischargeRating: 5,
  },
  'battery-holder-4xaa': {
    chemistry: 'nimh', cellCount: 4, capacityMah: 2000, dischargeRating: 5,
  },
  'battery-module-lowvoltage': {
    chemistry: 'lipo', cellCount: 2, capacityMah: 2200, dischargeRating: 5,
  },

  'sensor-distance-ultrasonic': {
    sensorType: 'distance', interfaceType: 'gpio', currentDrawMa: 15,
  },
  'sensor-line-reflectance': { sensorType: 'line', interfaceType: 'adc', currentDrawMa: 25 },
  'sensor-temp-humidity': { sensorType: 'temperature', interfaceType: 'i2c', currentDrawMa: 3 },
  'sensor-light': { sensorType: 'light', interfaceType: 'i2c', currentDrawMa: 2 },
  'sensor-soil-moisture': { sensorType: 'moisture', interfaceType: 'adc', currentDrawMa: 8 },

  'connectivity-onboard-bluetooth': { connectivityType: 'bluetooth', rangeMEstimate: 10 },
  'connectivity-onboard-wifi': { connectivityType: 'wifi', rangeMEstimate: 30 },
};

export interface KitToGraphOptions {
  /** Timestamp stamped on the new graph. Pass a fixed value for reproducibility. */
  now?: string;
  userMode?: UserMode;
  /** Add an operator app node fed by the kit's link. Defaults to true. */
  includeOperatorApp?: boolean;
}

/**
 * Load a kit definition as an editable ProductGraph.
 *
 * Every node records the component it came from in `sourceComponentId`, so the
 * graph maps back to an exact manifest. Node and connection ids are derived
 * from the kit and component ids, so the same kit always yields the same
 * graph structure.
 */
export function kitToGraph(
  kit: PhysicalKitDefinition,
  options: KitToGraphOptions = {},
): ProductGraph {
  const now = options.now ?? new Date().toISOString();
  const includeOperatorApp = options.includeOperatorApp ?? true;

  const nodes: LogicNode[] = [];
  let column = 0;

  for (const ref of kit.components) {
    const component = requireComponent(ref.componentId);
    if (component.satisfiesNodeType === null) continue;

    const nodeType = component.satisfiesNodeType;
    const plugin = nodeRegistry.require(nodeType);
    const parameters = COMPONENT_PARAMETERS[component.id] ?? {};

    for (let unit = 0; unit < ref.quantity; unit += 1) {
      nodes.push({
        id: `${kit.id}::${component.id}#${unit}`,
        type: nodeType,
        category: plugin.category,
        parameters: { ...parameters, sourceComponentId: component.id },
        capabilities: {},
        requirements: {},
        derivedMetrics: {},
        constraints: [],
        connectedNodes: [],
        position: { x: column * 180, y: unit * 120 },
        maturity: 'concept',
      });
    }
    column += 1;
  }

  if (includeOperatorApp) {
    const plugin = nodeRegistry.require('operator-app');
    nodes.push({
      id: `${kit.id}::operator-app#0`,
      type: 'operator-app',
      category: plugin.category,
      parameters: { appName: kit.name },
      capabilities: {},
      requirements: {},
      derivedMetrics: {},
      constraints: [],
      connectedNodes: [],
      position: { x: column * 180, y: 0 },
      maturity: 'concept',
    });
  }

  const connections = wireKitGraph(kit.id, nodes);
  const connected = applyAdjacency(nodes, connections);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: `graph_${kit.id}`,
    name: kit.name,
    nodes: connected,
    connections,
    userMode: options.userMode ?? 'builder',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Wire the standard kit topology: the pack and controller feed the driver,
 * the driver feeds the motors, the controller reads the sensors, and the link
 * carries the operator app. Kits without a driver retain direct motor wiring.
 */
function wireKitGraph(kitId: string, nodes: readonly LogicNode[]): Connection[] {
  const byType = (type: string) => nodes.filter(n => n.type === type);
  const battery = byType('battery')[0];
  const controller = byType('controller')[0];
  const driver = byType('driver')[0];
  const motors = byType('motor');
  // Servos contain their own switching stage. Only motors that require the
  // kit's external bridge belong downstream of that bridge.
  const drivenMotors = motors.filter(motor => motor.parameters.motorType !== 'servo');
  const directMotors = motors.filter(motor => motor.parameters.motorType === 'servo');
  const connections: Connection[] = [];

  const add = (from: string, to: string, type: Connection['type']) => {
    connections.push({ id: `${kitId}::conn#${connections.length}`, from, to, type });
  };

  if (battery) {
    for (const node of nodes) {
      if (node.id === battery.id) continue;
      // The operator app is software and draws nothing.
      if (node.type === 'operator-app') continue;
      // An instantiated driver is the motors' power stage. Connecting the
      // pack to the motors as well would bypass it and double-count the load.
      if (driver && drivenMotors.some(motor => motor.id === node.id)) continue;
      add(battery.id, node.id, 'power');
    }
  }

  if (controller) {
    if (driver) {
      add(controller.id, driver.id, 'control');
      for (const motor of drivenMotors) add(driver.id, motor.id, 'control');
      for (const motor of directMotors) add(controller.id, motor.id, 'control');
    } else {
      for (const motor of motors) add(controller.id, motor.id, 'control');
    }
    for (const sensor of byType('sensor')) add(controller.id, sensor.id, 'data');
    for (const link of byType('connectivity')) add(controller.id, link.id, 'data');
  }

  if (driver) {
    for (const motor of drivenMotors) add(driver.id, motor.id, 'power');
  }

  const app = byType('operator-app')[0];
  if (app) {
    const links = byType('connectivity');
    if (links.length > 0) {
      for (const link of links) add(link.id, app.id, 'data');
    } else if (controller) {
      // No separate radio: the controller's own link carries the app.
      add(controller.id, app.id, 'data');
    }
  }

  return connections;
}

function applyAdjacency(
  nodes: readonly LogicNode[],
  connections: readonly Connection[],
): LogicNode[] {
  const adjacency = new Map<string, Set<string>>(nodes.map(n => [n.id, new Set<string>()]));
  for (const conn of connections) {
    adjacency.get(conn.from)?.add(conn.to);
    adjacency.get(conn.to)?.add(conn.from);
  }
  return nodes.map(n => ({
    ...n,
    connectedNodes: [...(adjacency.get(n.id) ?? [])].sort(),
  }));
}
