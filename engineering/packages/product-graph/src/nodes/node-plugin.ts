import type {
  LogicNode,
  NodeCategory,
  ConnectionType,
  ProductGraph,
  UserMode,
} from '../schemas/product-graph.schema.js';

/**
 * Epistemic state of a derived value. The platform must never present an
 * estimate or a simulation as a measurement. Nodes annotate every derived
 * metric group so downstream consumers can tell what is actually known.
 */
export type EpistemicState = 'ESTIMATED' | 'CALCULATED' | 'SIMULATED' | 'MEASURED' | 'VERIFIED';

export type ConstraintSeverity = 'error' | 'warning' | 'info';

export interface ConstraintResult {
  /** Stable machine-readable identifier, used for deterministic ordering. */
  code: string;
  severity: ConstraintSeverity;
  message: string;
}

export interface ConnectionSpec {
  type: ConnectionType;
  direction: 'in' | 'out';
  label: string;
}

export interface ParameterBound {
  parameter: string;
  min?: number;
  max?: number;
  allowedValues?: readonly string[];
}

export type MetricValue = number | string | boolean;

/**
 * Everything a node is allowed to see while recalculating. Nodes never mutate
 * the graph; they read resolved upstream capabilities and return new values.
 */
export interface NodeContext {
  nodeId: string;
  graph: ProductGraph;
  userMode: UserMode;
  /**
   * Capabilities of directly upstream nodes, merged. Absent keys mean the
   * value is unknown — they are never defaulted to zero.
   */
  upstream: Record<string, unknown>;
  /** Directly upstream node records, in stable id order. */
  upstreamNodes: LogicNode[];
  /** Directly downstream node records, in stable id order. */
  downstreamNodes: LogicNode[];
  /**
   * Every node reachable by following edges downstream, in stable id order.
   * A power source uses this to see the whole load it actually carries.
   */
  transitiveDownstreamNodes: LogicNode[];
}

export interface NodePlugin<TParams> {
  nodeType: string;
  category: NodeCategory;
  defaultParameters: TParams;
  /** Coerce a raw parameter bag into typed parameters, applying defaults. */
  parseParameters(raw: Record<string, unknown>): TParams;
  validate(params: TParams, ctx: NodeContext): ConstraintResult[];
  deriveMetrics(params: TParams, ctx: NodeContext): Record<string, MetricValue>;
  exposeCapabilities(params: TParams, metrics: Record<string, MetricValue>): Record<string, unknown>;
  /** What this node needs from upstream. Absent means "no upstream demand". */
  exposeRequirements(params: TParams, metrics: Record<string, MetricValue>): Record<string, unknown>;
  acceptConnections(): readonly ConnectionSpec[];
  /** Bounds enforced in explore (beginner) mode. */
  getSafeParameterBounds(): readonly ParameterBound[];
}

/** Deterministic rounding so metrics never depend on float print precision. */
export function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Read a numeric capability, returning undefined (never 0) when unknown. */
export function readNumber(bag: Record<string, unknown>, key: string): number | undefined {
  const raw = bag[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

export function readBoolean(bag: Record<string, unknown>, key: string): boolean | undefined {
  const raw = bag[key];
  return typeof raw === 'boolean' ? raw : undefined;
}
