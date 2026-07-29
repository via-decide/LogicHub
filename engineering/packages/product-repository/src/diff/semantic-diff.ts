import type { LogicNode, ProductGraph } from '@logichub-engineering/product-graph';
import { propagate } from '@logichub-engineering/product-graph';
import type { ProductRevision } from '../schemas/revision.schema.js';
import type {
  AffectedArea,
  SemanticChange,
  SemanticProductDiff,
  ValidationCheck,
} from '../schemas/diff.schema.js';

/**
 * Compare two revisions and report what actually changed, what it reaches,
 * and what can be said about the result.
 *
 * The three sections are kept apart on purpose: a change is a fact, an
 * affected area is a consequence, and a validation check is a judgement. Only
 * the first is certain.
 */
export function semanticDiff(
  before: ProductRevision | null,
  after: ProductRevision,
): SemanticProductDiff {
  const beforeGraph = before === null ? null : propagate(before.graph).graph;
  const afterGraph = propagate(after.graph).graph;

  const changes = beforeGraph === null
    ? []
    : collectChanges(beforeGraph, afterGraph);

  const affectedAreas = collectAffectedAreas(changes, beforeGraph, afterGraph);
  const validationChecks = collectValidationChecks(afterGraph);

  const hasFailures = validationChecks.some(c => c.verdict === 'FAIL');
  const hasUnevaluatedAreas = affectedAreas.some(a => !a.evaluated);

  return {
    fromRevisionId: before?.revisionId ?? null,
    toRevisionId: after.revisionId,
    changes,
    affectedAreas,
    validationChecks,
    hasFailures,
    hasUnevaluatedAreas,
    summary: buildSummary(changes.length, hasFailures, hasUnevaluatedAreas),
  };
}

function collectChanges(before: ProductGraph, after: ProductGraph): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const beforeById = new Map(before.nodes.map(n => [n.id, n]));
  const afterById = new Map(after.nodes.map(n => [n.id, n]));
  const allIds = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort();

  for (const id of allIds) {
    const a = beforeById.get(id);
    const b = afterById.get(id);

    if (a === undefined && b !== undefined) {
      changes.push({
        kind: 'node-added',
        nodeId: id,
        nodeType: b.type,
        field: 'node',
        before: 'absent',
        after: b.type,
        headline: `${label(b)} added`,
      });
      continue;
    }
    if (a !== undefined && b === undefined) {
      changes.push({
        kind: 'node-removed',
        nodeId: id,
        nodeType: a.type,
        field: 'node',
        before: a.type,
        after: 'absent',
        headline: `${label(a)} removed`,
      });
      continue;
    }
    if (a === undefined || b === undefined) continue;

    for (const key of sortedKeys(a.parameters, b.parameters)) {
      const av = a.parameters[key];
      const bv = b.parameters[key];
      if (stringify(av) === stringify(bv)) continue;
      changes.push({
        kind: 'parameter-changed',
        nodeId: id,
        nodeType: b.type,
        field: key,
        before: stringify(av),
        after: stringify(bv),
        headline: buildHeadline(b, key, av, bv),
      });
    }

    for (const key of sortedKeys(a.derivedMetrics, b.derivedMetrics)) {
      const av = a.derivedMetrics[key];
      const bv = b.derivedMetrics[key];
      if (stringify(av) === stringify(bv)) continue;
      changes.push({
        kind: 'metric-changed',
        nodeId: id,
        nodeType: b.type,
        field: key,
        before: stringify(av),
        after: stringify(bv),
        headline: `${label(b)} ${key}: ${stringify(av)} -> ${stringify(bv)}`,
      });
    }
  }

  const beforeConnections = new Set(before.connections.map(connectionKey));
  const afterConnections = new Set(after.connections.map(connectionKey));

  for (const key of [...beforeConnections].sort()) {
    if (afterConnections.has(key)) continue;
    changes.push({
      kind: 'connection-changed',
      nodeId: null,
      nodeType: null,
      field: 'connection',
      before: key,
      after: 'absent',
      headline: `Connection removed: ${key}`,
    });
  }
  for (const key of [...afterConnections].sort()) {
    if (beforeConnections.has(key)) continue;
    changes.push({
      kind: 'connection-changed',
      nodeId: null,
      nodeType: null,
      field: 'connection',
      before: 'absent',
      after: key,
      headline: `Connection added: ${key}`,
    });
  }

  return changes;
}

/**
 * A battery cell-count change reads as "3S -> 4S" rather than "3 -> 4",
 * because that is how the change is actually discussed.
 */
function buildHeadline(node: LogicNode, key: string, before: unknown, after: unknown): string {
  if (node.type === 'battery' && key === 'cellCount') {
    return `Battery changed: ${stringify(before)}S -> ${stringify(after)}S`;
  }
  return `${label(node)} ${key}: ${stringify(before)} -> ${stringify(after)}`;
}

/**
 * Which domains the changes reach.
 *
 * Every area that the change touches is listed, including the ones nothing
 * here can evaluate. Omitting an unevaluable area would quietly narrow the
 * blast radius to whatever happens to be modelled.
 */
function collectAffectedAreas(
  changes: readonly SemanticChange[],
  before: ProductGraph | null,
  after: ProductGraph,
): AffectedArea[] {
  if (changes.length === 0) return [];

  const areas: AffectedArea[] = [];
  const supplyChanged = changes.some(
    c => c.nodeType === 'battery' && (c.field === 'cellCount' || c.field === 'nominalVoltageV'),
  );

  const metricChange = (nodeType: string, field: string): SemanticChange | undefined =>
    changes.find(c => c.nodeType === nodeType && c.field === field);

  if (supplyChanged) {
    const motorSpeed = metricChange('motor', 'speedMps');
    areas.push({
      area: 'Motor voltage',
      domain: 'electrical',
      reason: 'The supply the motors run from changed.',
      evaluated: true,
      effect: describeSupply(before, after),
    });
    areas.push({
      area: 'Motor speed',
      domain: 'electrical',
      reason: 'Motor output follows the supply it is given.',
      // Brushed motor speed scales with applied voltage, so this is normally
      // quantified. It stays unevaluated for a servo or stepper, whose speed
      // does not track the supply, and the distinction is worth preserving.
      evaluated: motorSpeed !== undefined,
      effect: motorSpeed === undefined
        ? null
        : `speedMps ${motorSpeed.before} -> ${motorSpeed.after}`,
    });
    areas.push({
      area: 'Driver voltage',
      domain: 'electrical',
      reason: 'The driver stage sits between the pack and the motors.',
      evaluated: false,
      effect: null,
    });
    areas.push({
      area: 'Regulator input',
      domain: 'electrical',
      reason: 'The controller supply is derived from the pack.',
      evaluated: true,
      effect: regulatorEffect(after),
    });
    areas.push({
      // Nothing in this release models thermal behaviour, so the area is
      // reported as reached but not assessed rather than passed over.
      area: 'Thermal load',
      domain: 'thermal',
      reason: 'Dissipation scales with the supply and the current drawn.',
      evaluated: false,
      effect: null,
    });

    const runtime = metricChange('battery', 'estimatedRuntimeH');
    areas.push({
      area: 'Runtime',
      domain: 'electrical',
      reason: 'Stored energy and load both moved.',
      evaluated: runtime !== undefined,
      effect: runtime === undefined ? null : `${runtime.before} h -> ${runtime.after} h`,
    });
    areas.push({
      area: 'Firmware limits',
      domain: 'firmware',
      reason: 'Duty-cycle and current limits are chosen against the supply.',
      evaluated: false,
      effect: null,
    });
    areas.push({
      area: 'Generated operator UI',
      domain: 'application',
      reason: 'Control ranges and telemetry bounds are derived from the graph.',
      evaluated: true,
      effect: 'Operator control ranges and telemetry bounds are regenerated.',
    });
  }

  for (const change of changes) {
    if (change.kind !== 'node-added' && change.kind !== 'node-removed') continue;
    areas.push({
      area: `Product composition (${change.nodeType ?? 'node'})`,
      domain: 'electrical',
      reason: change.headline,
      evaluated: true,
      effect: `Capability set changed; ${after.nodes.length} node(s) now present.`,
    });
  }

  return dedupeAreas(areas);
}

function describeSupply(before: ProductGraph | null, after: ProductGraph): string {
  const beforeV = batteryVoltage(before);
  const afterV = batteryVoltage(after);
  if (beforeV === undefined || afterV === undefined) {
    return 'Supply voltage changed; one side is unknown.';
  }
  return `Supply ${beforeV} V -> ${afterV} V`;
}

function regulatorEffect(after: ProductGraph): string {
  const controller = after.nodes.find(n => n.type === 'controller');
  if (controller === undefined) return 'No controller present.';
  return controller.constraints.includes('controller.regulator-required')
    ? 'Controller now requires a regulator stage.'
    : 'Controller supply remains inside its accepted range.';
}

function batteryVoltage(graph: ProductGraph | null): number | undefined {
  const battery = graph?.nodes.find(n => n.type === 'battery');
  const raw = battery?.derivedMetrics.nominalVoltageV;
  return typeof raw === 'number' ? raw : undefined;
}

/**
 * Validation checks over the resulting design.
 *
 * A check the platform cannot run is UNKNOWN with a reason. It is never
 * folded into PASS, and never omitted so the list looks clean.
 */
function collectValidationChecks(after: ProductGraph): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const constraintsOf = (type: string): string[] =>
    after.nodes.filter(n => n.type === type).flatMap(n => n.constraints);

  const controller = after.nodes.find(n => n.type === 'controller');
  if (controller === undefined) {
    checks.push({
      id: 'controller.input',
      label: 'Controller input',
      verdict: 'UNKNOWN',
      detail: 'No controller is present, so its supply could not be checked.',
    });
  } else {
    const failed = controller.constraints.some(
      c => c === 'controller.regulator-required' || c === 'controller.undervoltage',
    );
    checks.push({
      id: 'controller.input',
      label: 'Controller input',
      verdict: failed ? 'FAIL' : 'PASS',
      detail: failed
        ? `Controller reports ${controller.constraints.join(', ')}.`
        : 'Supply sits inside the controller accepted range.',
    });
  }

  const motors = after.nodes.filter(n => n.type === 'motor');
  if (motors.length === 0) {
    checks.push({
      id: 'motor.voltage',
      label: 'Motor voltage',
      verdict: 'UNKNOWN',
      detail: 'No motor is present.',
    });
  } else {
    const motorConstraints = constraintsOf('motor');
    const failed = motorConstraints.some(c => c.startsWith('motor.over') || c.startsWith('motor.under'));
    checks.push({
      id: 'motor.voltage',
      label: 'Motor voltage',
      verdict: failed ? 'FAIL' : 'PASS',
      detail: failed
        ? `Motors report ${[...new Set(motorConstraints)].sort().join(', ')}.`
        : 'Supply sits inside the motor tolerance band.',
    });
  }

  // No driver node exists in the model, so its margin cannot be computed from
  // the graph. Reporting UNKNOWN keeps the gap visible.
  checks.push({
    id: 'driver.margin',
    label: 'Driver margin',
    verdict: 'UNKNOWN',
    detail:
      'No driver stage is modelled, so its voltage and current margin could not be '
      + 'evaluated. This is not a pass.',
  });

  checks.push({
    id: 'thermal.load',
    label: 'Thermal load',
    verdict: 'UNKNOWN',
    detail: 'No thermal model has been run for this product. This is not a pass.',
  });

  return checks.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function dedupeAreas(areas: readonly AffectedArea[]): AffectedArea[] {
  const seen = new Map<string, AffectedArea>();
  for (const area of areas) {
    if (!seen.has(area.area)) seen.set(area.area, area);
  }
  return [...seen.values()].sort((a, b) => (a.area < b.area ? -1 : a.area > b.area ? 1 : 0));
}

function buildSummary(
  changeCount: number,
  hasFailures: boolean,
  hasUnevaluated: boolean,
): string {
  if (changeCount === 0) return 'No semantic change between these revisions.';
  const parts = [`${changeCount} semantic change(s).`];
  if (hasFailures) parts.push('At least one validation check failed.');
  if (hasUnevaluated) {
    parts.push('Some affected areas could not be evaluated and are not passes.');
  }
  return parts.join(' ');
}

function label(node: LogicNode): string {
  return `${node.type[0]!.toUpperCase()}${node.type.slice(1)}`;
}

function sortedKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
}

function stringify(value: unknown): string {
  if (value === undefined) return 'absent';
  if (value === null) return 'null';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function connectionKey(c: { from: string; to: string; type: string }): string {
  return `${c.from}->${c.to}:${c.type}`;
}
