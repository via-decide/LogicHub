export {
  NodeCategorySchema, type NodeCategory,
  UserModeSchema, type UserMode,
  MaturitySchema, type Maturity,
  ConnectionTypeSchema, type ConnectionType,
  PositionSchema, type Position,
  LogicNodeSchema, type LogicNode,
  ConnectionSchema, type Connection,
  ProductGraphSchema, type ProductGraph,
} from './schemas/product-graph.schema.js';

export {
  BatteryChemistrySchema, type BatteryChemistry,
  BatteryParamsSchema, type BatteryParams,
  ControllerModelSchema, type ControllerModel,
  ControllerParamsSchema, type ControllerParams,
  MotorTypeSchema, type MotorType,
  MotorParamsSchema, type MotorParams,
  SensorTypeSchema, type SensorType,
  SensorParamsSchema, type SensorParams,
  ConnectivityTypeSchema, type ConnectivityType,
  ConnectivityParamsSchema, type ConnectivityParams,
  SupplyEntrySchema, type SupplyEntry,
  OperatorAppParamsSchema, type OperatorAppParams,
} from './schemas/node-params.schema.js';

export {
  MatchVerdictSchema, type MatchVerdict,
  CapabilityOperatorSchema,
  CapabilityRequirementSchema, type CapabilityRequirement,
  ProductTemplateSchema, type ProductTemplate,
  MatchResultSchema, type MatchResult,
} from './schemas/discovery.schema.js';

export {
  createEmptyGraph,
  addNode,
  removeNode,
  connectNodes,
  disconnectNodes,
  updateNodeParameters,
  moveNode,
} from './graph/graph-ops.js';

export {
  serializeGraph,
  deserializeGraph,
} from './graph/serialization.js';

export {
  round,
  readNumber,
  readBoolean,
  type NodePlugin,
  type NodeContext,
  type ConstraintResult,
  type ConstraintSeverity,
  type ConnectionSpec,
  type ParameterBound,
  type EpistemicState,
  type MetricValue,
} from './nodes/node-plugin.js';
export { nodeRegistry } from './nodes/node-registry.js';
export { BatteryNode, MAX_RELEASE_PEAK_CURRENT_A } from './nodes/battery-node.js';
export { ControllerNode, CONTROLLER_PROFILES, type ControllerProfile } from './nodes/controller-node.js';
export { MotorNode } from './nodes/motor-node.js';
export { SensorNode } from './nodes/sensor-node.js';
export { ConnectivityNode } from './nodes/connectivity-node.js';
export {
  OperatorAppNode,
  generateAppSchema,
  type OperatorAppSchema,
  type AppControl,
  type AppTelemetryChannel,
  type AppAlert,
} from './nodes/operator-app-node.js';

export {
  propagate,
  topologicalOrder,
  type PropagationResult,
  type PropagationViolation,
} from './propagation/propagation-engine.js';

export { PRODUCT_TEMPLATES } from './discovery/templates.js';
export {
  matchProducts,
  aggregateCapabilities,
  CAN_MAKE_THRESHOLD,
  ALMOST_POSSIBLE_THRESHOLD,
} from './discovery/matcher.js';
