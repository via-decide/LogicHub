import type { LogicNode, ProductGraph } from '@logichub-engineering/product-graph';
import type { OperatingProfile } from '@logichub-engineering/contracts';
import {
  getRule,
  type PowerThermalInputs,
  type QuantityInput,
} from '@logichub-engineering/validation-engine';

/**
 * Thermal assessment for a product graph.
 *
 * Nothing new is modelled here. SEC-POWER-THERMAL-001 has computed
 * `T_est = T_ambient + P_loss * theta` since Phase 0, with a thermal-resistance
 * class and a refusal to guess when theta is unknown. What was missing was
 * anything that fed it: `OperatingProfile` was written and never imported, so
 * the semantic diff reported thermal load as reached-but-unassessed forever.
 *
 * This is the adapter. It turns a graph plus an operating profile into the
 * inputs that rule already takes, and hands back what the rule said.
 *
 * Ambient is an explicit input with no default. Assuming room temperature would
 * produce a temperature estimate for a product nobody said anything about the
 * environment of, and a number carries more authority than the assumption
 * behind it. With no profile the result is UNKNOWN.
 */

export type ThermalVerdict = 'PASS' | 'WARNING' | 'FAIL' | 'UNKNOWN' | 'REQUIRES_VALIDATION';

export interface GraphThermalResult {
  verdict: ThermalVerdict;
  /** Plain sentence naming what was computed, or why it could not be. */
  detail: string;
  /** Estimated temperature of the regulator stage — the only part the rule models. */
  estimatedTemperatureC: number | null;
  thermalMarginK: number | null;
  /** Regulator dissipation. Not the whole product's, and not the driver's. */
  dissipationW: number | null;
  /**
   * What the driver stages dissipate, summed, when they published a figure.
   *
   * Reported alongside rather than folded in. The rule estimates one stage's
   * temperature and the driver is not that stage, so this is a number a reader
   * should see and no verdict rests on it. A driver junction temperature needs
   * a rule of its own.
   */
  driverDissipationW: number | null;
  thermalResistanceClass: string;
  /** Inputs the rule reported as absent, in stable order. */
  missingInputs: string[];
  /** The rule that produced this, so a reader can go and check it. */
  ruleId: string;
  ruleVersion: string;
}

/** What the rule was told, kept so a caller can show its working. */
const RULE_ID = 'SEC-POWER-THERMAL-001';

/**
 * Maximum permitted component temperature, in degrees C.
 *
 * 85 is the commercial-grade ceiling the parts in the catalogue are specified
 * to. It is a published limit for that grade, not a measured one for any
 * particular board, and the result says which class of figure it used.
 */
const COMMERCIAL_GRADE_CEILING_C = 85;

/** The rule needs at least one load; a graph with no draw has nothing to assess. */
export function assessThermal(
  graph: ProductGraph,
  profile: OperatingProfile | null,
): GraphThermalResult {
  const base: GraphThermalResult = {
    verdict: 'UNKNOWN',
    detail: '',
    estimatedTemperatureC: null,
    thermalMarginK: null,
    dissipationW: null,
    driverDissipationW: sumDriverDissipation(graph),
    thermalResistanceClass: 'unknown',
    missingInputs: [],
    ruleId: RULE_ID,
    ruleVersion: getRule(RULE_ID)?.definition.ruleVersion ?? 'unknown',
  };

  if (profile === null) {
    return {
      ...base,
      detail:
        'No operating profile is attached, so ambient temperature is unknown and no '
        + 'temperature can be estimated. This is not a pass.',
    };
  }

  const inputs = buildInputs(graph, profile);
  if (inputs === null) {
    return {
      ...base,
      detail:
        'This graph publishes no current draw, so there is no dissipation to assess. '
        + 'This is not a pass.',
    };
  }

  const rule = getRule(RULE_ID);
  if (rule === undefined) {
    return { ...base, detail: `Rule ${RULE_ID} is not registered.` };
  }

  const result = rule.evaluate(inputs);
  const thermal = result.checks.find(check => check.check === 'regulator-thermal');

  const metrics = result.metrics as Record<string, number | string | null>;
  const estimated = numeric(metrics.estimatedRegulatorTemperature_degC);
  const margin = numeric(metrics.thermalMargin_degC);
  const dissipation = numeric(metrics.regulatorDissipation_W);
  const thetaClass = typeof metrics.thermalResistanceClass === 'string'
    ? metrics.thermalResistanceClass
    : 'unknown';

  return {
    ...base,
    verdict: toVerdict(thermal?.status),
    detail: thermal?.detail
      ?? 'The rule returned no thermal finding for this configuration. This is not a pass.',
    estimatedTemperatureC: estimated,
    thermalMarginK: margin,
    dissipationW: dissipation,
    thermalResistanceClass: thetaClass,
    missingInputs: result.unknowns.map(unknown => unknown.field).sort(),
  };
}

/**
 * Rule status to the verdict vocabulary the repository already uses.
 *
 * `requires_validation` keeps its own verdict rather than collapsing into PASS.
 * A temperature with margin computed from an estimated theta is not the same
 * claim as one computed from a measured one, and flattening them would let an
 * estimate be read as a result.
 */
function toVerdict(status: string | undefined): ThermalVerdict {
  switch (status) {
    case 'pass': return 'PASS';
    case 'warning': return 'WARNING';
    case 'fail': return 'FAIL';
    case 'requires_validation': return 'REQUIRES_VALIDATION';
    default: return 'UNKNOWN';
  }
}

/**
 * What the driver stages lose, summed.
 *
 * Null when no driver published a figure. A graph with drivers that resolved no
 * current is not a graph whose drivers dissipate nothing.
 */
function sumDriverDissipation(graph: ProductGraph): number | null {
  let total: number | null = null;
  for (const node of graph.nodes) {
    if (node.type !== 'driver') continue;
    const value = node.derivedMetrics.dissipationW;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    total = (total ?? 0) + value;
  }
  return total === null ? null : Math.round(total * 10000) / 10000;
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * A quantity as the rule expects it, carrying where it came from.
 *
 * Everything derived from the graph is graded `estimated`: these are figures
 * the node plugins calculated from nameplate data, not readings from a bench.
 * The rule caps an estimated-theta result at requires_validation on its own.
 */
function quantity(
  value: number,
  unit: string,
  provenance: string,
  evidenceGrade: QuantityInput['evidenceGrade'] = 'estimated',
): QuantityInput {
  return { value, unit, provenance, evidenceGrade };
}

function buildInputs(
  graph: ProductGraph,
  profile: OperatingProfile,
): PowerThermalInputs | null {
  const battery = graph.nodes.find(node => node.type === 'battery') ?? null;
  const loads = collectLoads(graph, profile);

  if (loads.length === 0) return null;

  const regulator = resolveRegulator(graph);

  return {
    battery: {
      nominalCapacity: readMetric(battery, 'capacityMah') === null
        ? null
        : quantity(readMetric(battery, 'capacityMah') as number, 'mAh', 'battery node parameter'),
      // Usable fraction of nameplate capacity. Declared here rather than
      // derived: no discharge curve has been measured for any pack in the
      // catalogue, and the rule needs to know that.
      deratingFactor: quantity(0.8, 'fraction', 'engineering estimate, unmeasured'),
      nominalVoltage: readMetric(battery, 'nominalVoltageV') === null
        ? null
        : quantity(readMetric(battery, 'nominalVoltageV') as number, 'V', 'battery node metric'),
      dischargeLimit: readMetric(battery, 'cutoffVoltageV') === null
        ? null
        : quantity(readMetric(battery, 'cutoffVoltageV') as number, 'V', 'battery node metric'),
    },
    loads,
    regulator,
    charger: {
      // Nothing in the graph charges while it runs, and saying otherwise would
      // invite the rule to assess a scenario this product does not have.
      chargingWhileOperating: false,
      loadSharingEvidence: false,
    },
    ambientTemperature: quantity(
      profile.ambientTemperature.nominal,
      profile.ambientTemperature.unit,
      'operating profile',
      'estimated',
    ),
    maxComponentTemperature: quantity(
      COMMERCIAL_GRADE_CEILING_C,
      'degC',
      'commercial temperature grade',
      'datasheet',
    ),
    intendedDuration: quantity(
      profile.maxContinuousRuntime.value,
      profile.maxContinuousRuntime.unit,
      'operating profile',
    ),
    // Enclosure resistance is genuinely unknown: no enclosure has been built.
    // The rule turns this into requires_validation on the enclosure check.
    enclosureThermalResistanceClass: 'unknown',
  };
}

/**
 * Every node that draws current, as a load the rule can weigh.
 *
 * A node with no published draw is left out rather than entered as zero. The
 * rule reports the loads it was given; a fabricated zero would quietly lower
 * the average and make everything look cooler than it is.
 */
function collectLoads(
  graph: ProductGraph,
  profile: OperatingProfile,
): PowerThermalInputs['loads'] {
  const duty = profile.dutyCycle?.value ?? 1;
  const loads: PowerThermalInputs['loads'] = [];

  for (const node of [...graph.nodes].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const current = nodeCurrentA(node);
    if (current === null) continue;

    loads.push({
      name: `${node.type}:${node.id}`,
      // Motors and drivers sit on the pack; logic sits behind the regulator.
      rail: node.type === 'motor' || node.type === 'driver' ? 'VBAT_SW' : '3V3',
      current: quantity(current, 'A', `${node.type} node metric`),
      duty: quantity(duty, 'fraction', profile.dutyCycle ? 'operating profile' : 'assumed continuous'),
      peakConcurrent: true,
    });
  }

  return loads;
}

function nodeCurrentA(node: LogicNode): number | null {
  // In preference order: what the node says it typically draws, then what it
  // says it draws at all. Never a stall figure, which is not a running load.
  for (const key of ['typicalCurrentA', 'drivenCurrentA', 'currentDrawA']) {
    const value = readMetric(node, key);
    if (value !== null) return value;
  }

  const milliamps = readMetric(node, 'currentDrawMa')
    ?? readMetric(node, 'activeCurrentMa')
    ?? readMetric(node, 'totalCurrentMa');
  return milliamps === null ? null : milliamps / 1000;
}

/**
 * The regulating stage, taken from the controller node.
 *
 * A development board's onboard regulator is a linear LDO in the parts this
 * catalogue lists, dropping the pack voltage to the logic rail. That is the
 * part whose temperature the rule estimates.
 *
 * Its thermal resistance is a property of the board it sits on, not of the
 * chip, so it is absent until someone declares it — and while it is absent the
 * rule refuses to produce a temperature. The driver's own theta is deliberately
 * not substituted here: the driver dissipates motor current on a different
 * rail, and attributing one part's package resistance to another part's loss
 * would produce a confident number about nothing.
 */
function resolveRegulator(graph: ProductGraph): PowerThermalInputs['regulator'] {
  const controller = graph.nodes.find(node => node.type === 'controller') ?? null;
  const battery = graph.nodes.find(node => node.type === 'battery') ?? null;

  const inputV = readMetric(battery, 'nominalVoltageV')
    ?? readMetric(controller, 'acceptedSupplyMinV')
    ?? 0;
  const outputV = readMetric(controller, 'operatingVoltageV') ?? 3.3;

  const theta = readMetric(controller, 'regulatorThermalResistanceKPerW');
  const thetaClass = theta === null
    ? 'unknown'
    : readString(controller, 'regulatorThermalResistanceClass') ?? 'unknown';

  return {
    topology: 'linear-ldo',
    inputVoltage: quantity(inputV, 'V', 'battery pack voltage'),
    outputVoltage: quantity(outputV, 'V', 'controller logic rail'),
    thermalResistance: theta === null
      ? null
      : quantity(theta, 'K/W', 'controller node parameter'),
    thermalResistanceClass: asThermalClass(thetaClass),
  };
}

function asThermalClass(value: string): PowerThermalInputs['regulator']['thermalResistanceClass'] {
  return value === 'measured' || value === 'datasheet' || value === 'estimated'
    ? value
    : 'unknown';
}

function readMetric(node: LogicNode | null, key: string): number | null {
  if (node === null) return null;
  const value = node.derivedMetrics[key] ?? node.parameters[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(node: LogicNode | null, key: string): string | null {
  if (node === null) return null;
  const value = node.derivedMetrics[key] ?? node.parameters[key];
  return typeof value === 'string' ? value : null;
}
