import type { NodePlugin } from './node-plugin.js';
import { BatteryNode } from './battery-node.js';
import { ControllerNode } from './controller-node.js';
import { DriverNode } from './driver-node.js';
import { MotorNode } from './motor-node.js';
import { SensorNode } from './sensor-node.js';
import { ConnectivityNode } from './connectivity-node.js';
import { OperatorAppNode } from './operator-app-node.js';

// Plugins are stored behind an unknown parameter type: the registry hands back
// a plugin whose parse/derive pipeline is internally consistent, and callers
// only ever move values from parseParameters into the other hooks.
export type AnyNodePlugin = NodePlugin<never> & {
  parseParameters(raw: Record<string, unknown>): unknown;
};

const PLUGINS = [
  BatteryNode,
  ControllerNode,
  DriverNode,
  MotorNode,
  SensorNode,
  ConnectivityNode,
  OperatorAppNode,
] as const;

const BY_TYPE = new Map<string, NodePlugin<unknown>>(
  PLUGINS.map(plugin => [plugin.nodeType, plugin as unknown as NodePlugin<unknown>]),
);

export const nodeRegistry = {
  get(nodeType: string): NodePlugin<unknown> | undefined {
    return BY_TYPE.get(nodeType);
  },

  require(nodeType: string): NodePlugin<unknown> {
    const plugin = BY_TYPE.get(nodeType);
    if (!plugin) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }
    return plugin;
  },

  has(nodeType: string): boolean {
    return BY_TYPE.has(nodeType);
  },

  /** All registered node types, in stable alphabetical order. */
  types(): string[] {
    return [...BY_TYPE.keys()].sort();
  },
};
