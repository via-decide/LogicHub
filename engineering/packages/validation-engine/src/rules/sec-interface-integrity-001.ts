import type { InterfaceIntegrityInputs } from '../contracts/rule-inputs.schema.js';
import type { RuleDefinition } from '../contracts/rule-definition.schema.js';
import type { CheckFinding, TraceStep } from '../contracts/rule-result.schema.js';
import { deriveConfidence } from '../confidence.js';
import { resolveQuantity, type MissingInput, type Quantity } from '../units/units.js';
import { buildResult, round, type UnhashedRuleResult } from './shared.js';

export const RULE_ID = 'SEC-INTERFACE-INTEGRITY-001';
export const RULE_VERSION = '0.1.0';

const THRESHOLDS = {
  gpioWarningFractionOfMax: 0.8,
  domainToleranceV: 0.0,
} as const;

export const definition: RuleDefinition = {
  ruleId: RULE_ID,
  ruleName: 'Electrical interface, pinout, and daughterboard protection',
  ruleVersion: RULE_VERSION,
  purpose:
    'Determine whether the controller, optical board, backlight, audio system, charger, and daughterboard interface are electrically compatible.',
  targetObjects: ['pin-map:*', 'interfaces:daughterboard', 'interfaces:usb-c'],
  requiredInputs: [
    { name: 'pins[]', unit: '-', description: 'Controller pin map with direction, voltage domain, strapping status' },
    { name: 'connections[]', unit: '-', description: 'Electrical connections between pins/boards' },
    { name: 'adcMaxInput', unit: 'V', description: 'ADC maximum input voltage' },
    { name: 'gpioMaxSource', unit: 'mA', description: 'GPIO source/sink limit' },
    { name: 'daughterboard', unit: '-', description: 'Rail, load allowances, grounds, keying, reserved pins, hot-plug claim + evidence' },
    { name: 'protection', unit: 'mA', description: 'PPTC hold/trip values' },
  ],
  optionalInputs: [
    { name: 'protection.downstreamDamageCurrent', unit: 'mA', description: 'Damaging current of the weakest protected element' },
    { name: 'exposedConductors[]', unit: '-', description: 'Exposed-conductor classification' },
  ],
  formulas: [
    { id: 'C1', expression: 'no connection may join two push-pull outputs', description: 'Output-output conflict' },
    { id: 'C2', expression: 'driverDomain <= receiverDomain + tolerance', description: 'Voltage-domain compatibility' },
    { id: 'C3', expression: 'appliedVoltage <= adcMaxInput', description: 'ADC overvoltage' },
    { id: 'C4', expression: 'sourceCurrent <= gpioMaxSource', description: 'GPIO overcurrent' },
    { id: 'C5', expression: 'strapping pin => explicit approved use', description: 'Restricted boot pins' },
    { id: 'C6', expression: 'groundPins >= minGroundPins', description: 'Ground return' },
    { id: 'C7', expression: 'requestedLoad <= maxLoad', description: 'Daughterboard load' },
    { id: 'C8', expression: 'pptcTrip <= downstreamDamageCurrent (where known)', description: 'Protection threshold' },
    { id: 'C9', expression: 'hotPlugClaim => sequencing AND inrush evidence', description: 'Hot-plug claim gate' },
  ],
  deterministicProcedure: [
    'Scan connections for output-output conflicts (C1) and voltage-domain mismatches (C2).',
    'Check every declared ADC application against the ADC ceiling (C3); a null applied voltage is a floating/undefined input (unknown).',
    'Check per-pin source currents against GPIO limits (C4).',
    'Reject any strapping-pin use without an explicit approval string (C5).',
    'Check ground-pin count, connector keying/orientation, mirrored-insertion possibility, reserved-pin usage, daughterboard load, PPTC thresholds, hot-plug claims, and exposed conductors.',
  ],
  assumptions: [
    'Voltage domains are compared as maxima; tolerant receivers must declare their tolerance in toDomain.',
    'Open-drain to open-drain connections are legal by construction.',
  ],
  thresholds: [
    { name: 'gpioWarningFractionOfMax', value: THRESHOLDS.gpioWarningFractionOfMax, description: 'Source current above this fraction of max is a warning' },
    { name: 'domainToleranceV', value: THRESHOLDS.domainToleranceV, unit: 'V', description: 'Allowed driver overshoot above receiver domain' },
  ],
  outputStates: ['pass', 'warning', 'fail', 'unknown', 'error', 'requires_validation'],
  confidenceRules: [
    'insufficient_evidence when limits (ADC max, GPIO max) are absent',
    'deterministic_estimated_inputs when limits are engineering estimates (datasheet not in corpus)',
  ],
  evidenceRequirements: [
    'Controller datasheet for ADC/GPIO limits',
    'Connector drawing for keying claims',
    'PPTC datasheet for hold/trip values',
  ],
  failureModes: [
    'Mirrored connector applies VBAT to logic pins',
    '5 V signal into 3.3 V input',
    'Contending push-pull outputs',
    'Daughterboard overload browning out the 3V3 rail',
    'Boot-strap pin conflict making the console unbootable',
  ],
  requiredTestFixtureTypes: [
    'correct reference pin map',
    'mirrored connector',
    '5 V signal into 3.3 V input',
    'two outputs connected together',
    'daughterboard current above limit',
    'missing common ground',
    'reversed daughterboard insertion',
    'floating ADC input',
    'shared boot-strapping pin',
    'hot-plug request without protection evidence',
  ],
  physicalValidationProcedure: [
    'validation-plan test 9: daughterboard overcurrent test',
    'validation-plan test 10: reversed-connector prevention test',
  ],
  limitations: [
    'Static netlist-level checks only; no transient/SI analysis.',
    'Trusts declared pin directions; cannot detect firmware misconfiguration.',
  ],
};

export function evaluate(inputs: InterfaceIntegrityInputs): UnhashedRuleResult {
  const missing: MissingInput[] = [];
  const trace: TraceStep[] = [];
  const checks: CheckFinding[] = [];
  const warnings: string[] = [];
  const consumed: Array<Quantity | null | undefined> = [];

  const adcMax = resolveQuantity(inputs.adcMaxInput, 'voltage', 'adcMaxInput', missing);
  const gpioMax = resolveQuantity(inputs.gpioMaxSource, 'current', 'gpioMaxSource', missing);
  consumed.push(inputs.adcMaxInput, inputs.gpioMaxSource, inputs.logicVoltage);

  // C1 + C2: connection scan
  const conflicts: string[] = [];
  const domainViolations: string[] = [];
  for (const conn of inputs.connections) {
    if (conn.fromDirection === 'out' && conn.toDirection === 'out') {
      conflicts.push(`${conn.id}: ${conn.fromPin} <-> ${conn.toPin}`);
    }
    const fromD = conn.fromDomain === null ? null : resolveQuantity(conn.fromDomain, 'voltage', `${conn.id}.fromDomain`, []);
    const toD = conn.toDomain === null ? null : resolveQuantity(conn.toDomain, 'voltage', `${conn.id}.toDomain`, []);
    if (fromD !== null && toD !== null && fromD.value > toD.value + THRESHOLDS.domainToleranceV) {
      domainViolations.push(`${conn.id}: ${conn.fromPin} (${fromD.value} V) drives ${conn.toPin} (${toD.value} V domain)`);
    }
  }
  checks.push(
    conflicts.length > 0
      ? { check: 'output-output-conflict', status: 'fail', detail: `Push-pull outputs connected together: ${conflicts.sort().join('; ')}.`, observed: conflicts.sort() }
      : { check: 'output-output-conflict', status: 'pass', detail: `No output-to-output conflicts across ${inputs.connections.length} connection(s).` },
  );
  checks.push(
    domainViolations.length > 0
      ? { check: 'voltage-domain', status: 'fail', detail: `Voltage-domain mismatch: ${domainViolations.sort().join('; ')}.`, observed: domainViolations.sort() }
      : { check: 'voltage-domain', status: 'pass', detail: 'No voltage-domain mismatches in declared connections.' },
  );

  // C3: ADC applications
  const adcFindings: CheckFinding[] = [];
  for (const a of inputs.adcApplied) {
    if (a.appliedVoltage === null) {
      adcFindings.push({
        check: `adc-input:${a.pin}`, status: 'unknown',
        detail: `${a.pin}: applied voltage undefined (floating input). Floating ADC inputs are undefined behavior — unknown, not pass.`,
      });
      continue;
    }
    const v = resolveQuantity(a.appliedVoltage, 'voltage', `adcApplied.${a.pin}`, missing);
    consumed.push(a.appliedVoltage);
    if (v === null || adcMax === null) {
      adcFindings.push({ check: `adc-input:${a.pin}`, status: 'unknown', detail: `${a.pin}: ADC ceiling or applied voltage unavailable.` });
    } else if (v.value > adcMax.value) {
      adcFindings.push({
        check: `adc-input:${a.pin}`, status: 'fail',
        detail: `${a.pin}: applied ${v.value} V exceeds ADC maximum ${adcMax.value} V.`,
        threshold: adcMax.value, observed: v.value,
      });
    } else {
      adcFindings.push({ check: `adc-input:${a.pin}`, status: 'pass', detail: `${a.pin}: ${v.value} V within ADC ceiling ${adcMax.value} V.`, threshold: adcMax.value, observed: v.value });
    }
  }
  checks.push(...adcFindings);

  // C4: GPIO overcurrent + C5: strapping pins
  for (const pin of inputs.pins) {
    const src = pin.sourceCurrent ?? null;
    if (src !== null && src !== undefined) {
      const c = resolveQuantity(src, 'current', `pins.${pin.pin}.sourceCurrent`, missing);
      consumed.push(src);
      if (c !== null && gpioMax !== null) {
        if (c.value > gpioMax.value) {
          checks.push({
            check: `gpio-current:${pin.pin}`, status: 'fail',
            detail: `${pin.pin} sources ${round(c.value * 1000, 3)} mA, above the ${round(gpioMax.value * 1000, 3)} mA limit.`,
            threshold: gpioMax.value, observed: c.value,
          });
        } else if (c.value > gpioMax.value * THRESHOLDS.gpioWarningFractionOfMax) {
          checks.push({
            check: `gpio-current:${pin.pin}`, status: 'warning',
            detail: `${pin.pin} sources ${round(c.value * 1000, 3)} mA, above ${THRESHOLDS.gpioWarningFractionOfMax * 100}% of the limit.`,
            threshold: gpioMax.value * THRESHOLDS.gpioWarningFractionOfMax, observed: c.value,
          });
        }
      }
    }
    if (pin.strapping && (pin.approvedStrappingUse === undefined || pin.approvedStrappingUse.length === 0)) {
      checks.push({
        check: `strapping-pin:${pin.pin}`, status: 'fail',
        detail: `${pin.pin} is a restricted boot-strapping pin used as '${pin.function}' without an explicit approval record.`,
      });
    }
  }

  // C6-C9 + keying/reserved/exposed
  const db = inputs.daughterboard;
  if (db.groundPins === null) {
    checks.push({ check: 'ground-return', status: 'unknown', detail: 'Ground-pin count undeclared.' });
  } else if (db.groundPins < db.minGroundPins) {
    checks.push({
      check: 'ground-return', status: 'fail',
      detail: `Daughterboard interface has ${db.groundPins} ground pin(s); minimum is ${db.minGroundPins}. Missing common ground breaks signal return.`,
      threshold: db.minGroundPins, observed: db.groundPins,
    });
  } else {
    checks.push({ check: 'ground-return', status: 'pass', detail: `${db.groundPins} ground pins >= required ${db.minGroundPins}.`, threshold: db.minGroundPins, observed: db.groundPins });
  }

  if (db.connectorKeyed === null || db.connectorOrientationDefined === null) {
    checks.push({ check: 'connector-orientation', status: 'unknown', detail: 'Connector keying/orientation undeclared.' });
  } else if (!db.connectorKeyed || !db.connectorOrientationDefined) {
    checks.push({ check: 'connector-orientation', status: 'fail', detail: 'Connector orientation is not mechanically defined — reversed insertion is possible.' });
  } else if (db.mirroredInsertionPossible === true) {
    checks.push({ check: 'connector-orientation', status: 'fail', detail: 'Mirrored insertion is mechanically possible despite keying claim — pin map would be reversed onto live rails.' });
  } else {
    checks.push({ check: 'connector-orientation', status: 'pass', detail: 'Connector keyed, orientation defined, mirrored insertion mechanically blocked.' });
  }

  const maxLoad = resolveQuantity(db.maxLoad, 'current', 'daughterboard.maxLoad', missing);
  const reqLoad = resolveQuantity(db.requestedLoad, 'current', 'daughterboard.requestedLoad', missing);
  consumed.push(db.maxLoad, db.requestedLoad);
  if (maxLoad === null || reqLoad === null) {
    checks.push({ check: 'daughterboard-load', status: 'unknown', detail: 'Daughterboard load allowance or requested load undeclared.' });
  } else if (reqLoad.value > maxLoad.value) {
    checks.push({
      check: 'daughterboard-load', status: 'fail',
      detail: `Requested daughterboard load ${round(reqLoad.value * 1000, 3)} mA exceeds the defined maximum ${round(maxLoad.value * 1000, 3)} mA.`,
      threshold: maxLoad.value, observed: reqLoad.value,
    });
  } else {
    checks.push({ check: 'daughterboard-load', status: 'pass', detail: `Requested load ${round(reqLoad.value * 1000, 3)} mA within the ${round(maxLoad.value * 1000, 3)} mA allowance.`, threshold: maxLoad.value, observed: reqLoad.value });
  }

  const pptcHold = resolveQuantity(inputs.protection.pptcHold, 'current', 'protection.pptcHold', missing);
  const pptcTrip = resolveQuantity(inputs.protection.pptcTrip, 'current', 'protection.pptcTrip', missing);
  consumed.push(inputs.protection.pptcHold, inputs.protection.pptcTrip);
  const damage = inputs.protection.downstreamDamageCurrent ?? null;
  if (pptcTrip === null) {
    checks.push({ check: 'protection-threshold', status: 'unknown', detail: 'PPTC trip current undeclared.' });
  } else if (damage !== null && damage !== undefined) {
    const dmg = resolveQuantity(damage, 'current', 'protection.downstreamDamageCurrent', missing);
    consumed.push(damage);
    if (dmg !== null && pptcTrip.value > dmg.value) {
      checks.push({
        check: 'protection-threshold', status: 'warning',
        detail: `PPTC trip ${round(pptcTrip.value * 1000, 3)} mA is above the downstream damaging current ${round(dmg.value * 1000, 3)} mA — protection fires too late where feasible protection exists.`,
        threshold: dmg.value, observed: pptcTrip.value,
      });
    } else if (dmg !== null) {
      checks.push({ check: 'protection-threshold', status: 'pass', detail: `PPTC trip ${round(pptcTrip.value * 1000, 3)} mA below damaging current ${round(dmg.value * 1000, 3)} mA.`, threshold: dmg.value, observed: pptcTrip.value });
    }
  } else if (pptcHold !== null && maxLoad !== null && pptcHold.value < maxLoad.value) {
    checks.push({
      check: 'protection-threshold', status: 'warning',
      detail: `PPTC hold ${round(pptcHold.value * 1000, 3)} mA is below the declared load allowance ${round(maxLoad.value * 1000, 3)} mA — nuisance trips likely.`,
      threshold: maxLoad.value, observed: pptcHold.value,
    });
  } else {
    checks.push({ check: 'protection-threshold', status: 'pass', detail: 'PPTC thresholds declared and consistent with the load allowance (damage current not declared — protection adequacy vs damage remains an open evidence item).' });
  }

  const reservedUsed = db.reservedPinsUsed.filter(p => db.reservedPins.includes(p));
  checks.push(
    reservedUsed.length > 0
      ? { check: 'reserved-pins', status: 'fail', detail: `Reserved pins are in use: ${reservedUsed.sort().join(', ')}. Reserved pins must remain unused.`, observed: reservedUsed.sort() }
      : { check: 'reserved-pins', status: 'pass', detail: 'All reserved pins remain unused.' },
  );

  if (db.hotPlugClaim && !(db.hotPlugSequencingEvidence && db.hotPlugInrushEvidence)) {
    checks.push({
      check: 'hot-plug-claim', status: 'fail',
      detail: 'Hot-plug support is claimed but sequencing and/or inrush behavior is undefined — the claim is rejected until design + test evidence exists (DEC-004).',
    });
  } else if (db.hotPlugClaim) {
    checks.push({ check: 'hot-plug-claim', status: 'requires_validation', detail: 'Hot-plug claim has declared design evidence; physical hot-plug testing still required before acceptance.' });
  } else {
    checks.push({ check: 'hot-plug-claim', status: 'pass', detail: 'No hot-plug claim made (insertion/removal only with power off).' });
  }

  for (const ec of inputs.exposedConductors) {
    if (!ec.bare) continue;
    if (ec.accessibleToStudents === true) {
      checks.push({
        check: `exposed-conductor:${ec.location}`, status: 'fail',
        detail: `Bare conductor at '${ec.location}' is accessible to students or conductive objects — prohibited (con-sec-no-bare-conductors).`,
      });
    } else if (ec.accessibleToStudents === null) {
      checks.push({
        check: `exposed-conductor:${ec.location}`, status: 'requires_validation',
        detail: `Bare conductor at '${ec.location}' has undetermined accessibility — physical accessibility check required.`,
      });
    } else {
      checks.push({ check: `exposed-conductor:${ec.location}`, status: 'warning', detail: `Bare conductor at '${ec.location}' inside enclosure — verify clearances (wiring-groove short-circuit risk).` });
    }
  }

  if (missing.length > 0) {
    checks.push({
      check: 'input-completeness', status: 'unknown',
      detail: `Required inputs absent: ${[...new Set(missing.map(m => m.field))].sort().join(', ')}.`,
    });
  }

  trace.push({
    step: 'interface-scan',
    inputs: { pinCount: inputs.pins.length, connectionCount: inputs.connections.length, adcApplications: inputs.adcApplied.length },
    output: { checkCount: checks.length, conflicts: conflicts.length, domainViolations: domainViolations.length },
  });

  const confidence = deriveConfidence({
    requiredInputGrades: consumed.filter((q): q is Quantity => q != null).map(q => q.evidenceGrade ?? 'unknown'),
    missingRequiredCount: missing.length,
  });

  return buildResult({
    ruleId: RULE_ID,
    ruleVersion: RULE_VERSION,
    inputs: {
      adcMaxInput: adcMax === null ? null : { value: adcMax.value, unit: adcMax.unit },
      gpioMaxSource: gpioMax === null ? null : { value: gpioMax.value, unit: gpioMax.unit },
      pinCount: inputs.pins.length,
      connectionCount: inputs.connections.length,
      daughterboard: {
        groundPins: db.groundPins,
        hotPlugClaim: db.hotPlugClaim,
        reservedPinsUsed: [...db.reservedPinsUsed].sort(),
      },
    },
    inputProvenance: {
      adcMaxInput: inputs.adcMaxInput?.provenance ?? 'absent',
      gpioMaxSource: inputs.gpioMaxSource?.provenance ?? 'absent',
    },
    assumptions: definition.assumptions,
    procedure: definition.formulas.map(f => `${f.id}: ${f.expression}`),
    trace,
    thresholds: { ...THRESHOLDS },
    checks,
    metrics: {
      outputConflictCount: conflicts.length,
      domainViolationCount: domainViolations.length,
      failedCheckCount: checks.filter(c => c.status === 'fail').length,
    },
    confidence,
    unknowns: missing,
    warnings,
    failureModes: definition.failureModes,
    requiredTests: definition.physicalValidationProcedure,
    affectedObjects: definition.targetObjects,
    evidenceReferences: [],
  });
}
