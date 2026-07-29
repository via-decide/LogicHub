import type { LogicNode, ProductGraph } from '@logichub-engineering/product-graph';
import { aggregateCapabilities } from '@logichub-engineering/product-graph';
import { requireComponent } from '../catalogue/components.js';
import { REFERENCE_KITS } from '../kits/index.js';
import type { PhysicalComponent } from '../schemas/component.schema.js';
import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';
import type {
  IncompatibleAssumption,
  KitMatch,
  MissingComponent,
  ResolvedComponent,
} from '../schemas/kit-match.schema.js';
import { aggregateAvailability, checkSupplyVoltage, totalCost } from './compatibility.js';

/**
 * Match a configuration against the reference kits.
 *
 * A match describes how completely a kit's parts cover the configuration. It
 * is not a statement that the kit can be bought, has ever been assembled, or
 * has been shown to work — those are carried separately by the sourcing and
 * validation states, which stay unknown and unvalidated until real evidence
 * exists.
 *
 * Deterministic: the same graph always produces the same matches in the same
 * order.
 */
export function matchKits(
  graph: ProductGraph,
  kits: readonly PhysicalKitDefinition[] = REFERENCE_KITS,
): KitMatch[] {
  const matches = kits.map(kit => evaluateKit(graph, kit));

  matches.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    if (a.matchPercentage !== b.matchPercentage) return b.matchPercentage - a.matchPercentage;
    // Between two kits that both cover the configuration, the one with less
    // left over is the closer fit.
    if (a.surplusComponentCount !== b.surplusComponentCount) {
      return a.surplusComponentCount - b.surplusComponentCount;
    }
    return a.kitId < b.kitId ? -1 : a.kitId > b.kitId ? 1 : 0;
  });

  return matches;
}

function evaluateKit(graph: ProductGraph, kit: PhysicalKitDefinition): KitMatch {
  const capabilities = aggregateCapabilities(graph);
  const supplyV = readNumber(capabilities, 'power.voltageV');

  // Nodes in stable id order, so assignment never depends on insertion order.
  const nodes = [...graph.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Remaining unit count per kit component, consumed as nodes are covered.
  const remaining = new Map(kit.components.map(c => [c.componentId, c.quantity]));
  const coverage = new Map<string, string[]>();
  const missingComponents: MissingComponent[] = [];
  const incompatibleAssumptions: IncompatibleAssumption[] = [];

  for (const node of nodes) {
    // A node with no physical counterpart (the operator app) is software; it
    // is neither covered nor missing, and is tracked as app support instead.
    if (!isPhysicalNodeType(node.type)) continue;

    const available = (componentId: string) => (remaining.get(componentId) ?? 0) > 0;

    // A node loaded from a kit records the component it came from, so it maps
    // back to that exact part rather than to whatever else fits its type.
    const source = node.parameters.sourceComponentId;
    const candidate = (typeof source === 'string'
      ? kit.components.find(ref => ref.componentId === source && available(ref.componentId))
      : undefined)
      ?? kit.components.find(ref =>
        available(ref.componentId)
        && requireComponent(ref.componentId).satisfiesNodeType === node.type);

    if (!candidate) {
      missingComponents.push({
        nodeId: node.id,
        nodeType: node.type,
        message: `${kit.name} has no ${node.type} left to cover this node.`,
      });
      continue;
    }

    remaining.set(candidate.componentId, (remaining.get(candidate.componentId) ?? 0) - 1);
    const covered = coverage.get(candidate.componentId) ?? [];
    covered.push(node.id);
    coverage.set(candidate.componentId, covered);

    const component = requireComponent(candidate.componentId);
    collectNodeIncompatibilities(node, component, supplyV, incompatibleAssumptions);
  }

  const componentManifest: ResolvedComponent[] = kit.components.map(ref => ({
    component: requireComponent(ref.componentId),
    quantity: ref.quantity,
    role: ref.role,
    coversNodeIds: [...(coverage.get(ref.componentId) ?? [])].sort(),
  }));

  collectKitIncompatibilities(graph, kit, capabilities, supplyV, incompatibleAssumptions);
  incompatibleAssumptions.sort(compareAssumptions);

  const physicalNodeCount = nodes.filter(n => isPhysicalNodeType(n.type)).length;
  const coveredCount = physicalNodeCount - missingComponents.length;
  const matchPercentage = physicalNodeCount === 0
    ? 0
    : Math.round((coveredCount / physicalNodeCount) * 100);

  // Units that could have stood behind a node but were not needed.
  const surplusComponentCount = componentManifest.reduce(
    (total, resolved) =>
      resolved.component.satisfiesNodeType === null
        ? total
        : total + (resolved.quantity - resolved.coversNodeIds.length),
    0,
  );

  const hasController = nodes.some(n => n.type === 'controller');
  const kitHasController = kit.components.some(
    ref => requireComponent(ref.componentId).satisfiesNodeType === 'controller',
  );
  const hasApp = nodes.some(n => n.type === 'operator-app');
  const kitProvidesLink = componentManifest.some(
    r => r.component.providesCapabilities['wireless.any'] === true,
  );

  return {
    kitId: kit.id,
    kitName: kit.name,
    matchPercentage,
    componentManifest,
    supportedProductTemplateIds: [...kit.supportedProductTemplateIds],
    missingComponents,
    surplusComponentCount,
    incompatibleAssumptions,
    estimatedTotalCost: totalCost(componentManifest),
    supplierAvailability: aggregateAvailability(componentManifest),
    assemblyDifficulty: kit.assemblyDifficulty,
    requiredTools: [...kit.requiredTools],
    firmwareSupport: hasController && kitHasController,
    generatedAppSupport: hasApp && kitProvidesLink,
    upgradePaths: [...kit.upgradeOptions],
    validationStatus: kit.validationStatus,
    complete:
      physicalNodeCount > 0
      && missingComponents.length === 0
      && incompatibleAssumptions.length === 0,
  };
}

/** Node types that a physical component can stand behind. */
function isPhysicalNodeType(nodeType: string): boolean {
  return nodeType !== 'operator-app';
}

function collectNodeIncompatibilities(
  node: LogicNode,
  component: PhysicalComponent,
  supplyV: number | undefined,
  out: IncompatibleAssumption[],
): void {
  // A battery defines the supply rather than consuming it, so checking it
  // against its own output would be circular.
  if (node.type === 'battery') return;

  const verdict = checkSupplyVoltage(component, supplyV);
  if (verdict.unknown) {
    // An unevaluated check is recorded, not silently passed. Components with
    // no electrical envelope at all are structural parts and are not flagged.
    if (component.electrical !== null) {
      out.push({
        code: 'supply.unevaluated',
        nodeId: node.id,
        componentId: component.id,
        message: verdict.message,
      });
    }
    return;
  }
  if (!verdict.compatible) {
    out.push({
      code: 'supply.out-of-range',
      nodeId: node.id,
      componentId: component.id,
      message: verdict.message,
    });
  }
}

function collectKitIncompatibilities(
  graph: ProductGraph,
  kit: PhysicalKitDefinition,
  capabilities: Record<string, unknown>,
  supplyV: number | undefined,
  out: IncompatibleAssumption[],
): void {
  const manifest = kit.components.map(ref => requireComponent(ref.componentId));

  // A brushed motor needs a driver stage the kit must actually contain.
  const needsHBridge = graph.nodes.some(
    n => n.type === 'motor' && n.derivedMetrics.driverRequirement === 'h-bridge',
  );
  const hasHBridge = manifest.some(c => c.providesCapabilities['driver.h-bridge'] === true);
  if (needsHBridge && !hasHBridge) {
    out.push({
      code: 'driver.missing',
      nodeId: null,
      componentId: null,
      message: `${kit.name} contains no H-bridge driver, which the configured motors require.`,
    });
  }

  // A link the configuration relies on must be present in the kit.
  for (const link of ['wireless.bluetooth', 'wireless.wifi'] as const) {
    if (capabilities[link] !== true) continue;
    const provided = manifest.some(c => c.providesCapabilities[link] === true);
    if (!provided) {
      out.push({
        code: 'connectivity.missing',
        nodeId: null,
        componentId: null,
        message: `The configuration uses ${link} but ${kit.name} provides no such radio.`,
      });
    }
  }

  if (supplyV === undefined && graph.nodes.length > 0) {
    out.push({
      code: 'supply.unknown',
      nodeId: null,
      componentId: null,
      message: 'The configuration publishes no supply voltage; electrical fit is unevaluated.',
    });
  }
}

function compareAssumptions(a: IncompatibleAssumption, b: IncompatibleAssumption): number {
  if (a.code !== b.code) return a.code < b.code ? -1 : 1;
  const an = a.nodeId ?? '';
  const bn = b.nodeId ?? '';
  if (an !== bn) return an < bn ? -1 : 1;
  const ac = a.componentId ?? '';
  const bc = b.componentId ?? '';
  return ac < bc ? -1 : ac > bc ? 1 : 0;
}

function readNumber(bag: Record<string, unknown>, key: string): number | undefined {
  const raw = bag[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}
