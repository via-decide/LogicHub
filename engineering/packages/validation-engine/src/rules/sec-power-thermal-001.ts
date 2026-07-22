import type { PowerThermalInputs } from '../contracts/rule-inputs.schema.js';
import type { RuleDefinition } from '../contracts/rule-definition.schema.js';
import type { CheckFinding, TraceStep } from '../contracts/rule-result.schema.js';
import { deriveConfidence } from '../confidence.js';
import {
  resolveQuantity,
  weakestEvidenceGrade,
  type MissingInput,
  type NormalizedQuantity,
  type Quantity,
} from '../units/units.js';
import { buildResult, round, type UnhashedRuleResult } from './shared.js';

export const RULE_ID = 'SEC-POWER-THERMAL-001';
export const RULE_VERSION = '0.1.0';

const THRESHOLDS = {
  runtimeWarningFactor: 1.2,
  thermalWarningMarginDegC: 10,
} as const;

export const definition: RuleDefinition = {
  ruleId: RULE_ID,
  ruleName: 'Power, battery runtime, and thermal feasibility',
  ruleVersion: RULE_VERSION,
  purpose:
    'Determine whether the configured console power system can support the intended classroom session without violating battery, regulator, charger, or component-temperature constraints.',
  targetObjects: ['power-tree:battery', 'power-tree:ldo-3v3', 'power-tree:charger', 'power-tree:3V3', 'power-tree:VBAT_SW'],
  requiredInputs: [
    { name: 'battery.nominalCapacity', unit: 'mAh|Ah', description: 'Battery nominal capacity' },
    { name: 'battery.deratingFactor', unit: 'fraction|percent', description: 'Usable-capacity derating factor' },
    { name: 'battery.nominalVoltage', unit: 'V', description: 'Battery nominal voltage' },
    { name: 'battery.dischargeLimit', unit: 'V', description: 'Battery discharge floor under load' },
    { name: 'loads[]', unit: 'mA + fraction', description: 'Duty-weighted subsystem currents (MCU active/idle, RGB strobe, backlight, audio, LDR dividers, daughterboard allowance)' },
    { name: 'regulator', unit: '-', description: 'Regulator topology, voltages, efficiency or loss model, thermal resistance + class' },
    { name: 'ambientTemperature', unit: 'degC', description: 'Ambient temperature' },
    { name: 'maxComponentTemperature', unit: 'degC', description: 'Maximum permitted component temperature' },
    { name: 'intendedDuration', unit: 'h', description: 'Intended operating duration' },
  ],
  optionalInputs: [
    { name: 'charger.programCurrent', unit: 'mA', description: 'Charger program current' },
    { name: 'maxTouchTemperature', unit: 'degC', description: 'Touchable-surface ceiling' },
  ],
  formulas: [
    { id: 'F1', expression: 'I_average = sum(duty_i * I_i)', description: 'Duty-weighted average load (battery-referred)' },
    { id: 'F2', expression: 'C_usable = C_nominal * derating', description: 'Usable battery capacity' },
    { id: 'F3', expression: 't_runtime = C_usable / I_average', description: 'Estimated runtime' },
    { id: 'F4', expression: 'P_regulator = (V_in - V_out) * I_out', description: 'Linear regulator dissipation' },
    { id: 'F5', expression: 'P_converter = P_out * (1/eta - 1)', description: 'Switching converter loss' },
    { id: 'F6', expression: 'T_est = T_ambient + P_loss * theta', description: 'First-order temperature estimate' },
    { id: 'F7', expression: 'P_charger = (V_usb - V_batt) * I_charge', description: 'Linear charger dissipation bound while charging' },
  ],
  deterministicProcedure: [
    'Normalize all quantities to canonical units (A, V, W, Ah, h, degC, K/W, fraction); record any missing input.',
    'Compute duty-weighted average current F1 and concurrent peak current.',
    'Compute usable capacity F2 and runtime F3; compare against intendedDuration.',
    'Compute regulator dissipation (F4 linear / F5 switching); missing efficiency for switching is a MissingInput, never assumed.',
    'Compute F6 with the declared thermal-resistance class (measured|datasheet|estimated|unknown); estimated theta can at best yield requires_validation, unknown theta yields unknown.',
    'Assess charge-while-operate: without load-sharing evidence the charging scenario is requires_validation.',
    'Combine check statuses; unknown never becomes pass.',
  ],
  assumptions: [
    'Linear regulation passes battery current 1:1 to the 3V3 loads.',
    'First-order thermal model: no convection modelling; enclosure resistance handled by declared class only.',
    'Peak current sums all concurrent-capable loads simultaneously.',
  ],
  thresholds: [
    { name: 'runtimeWarningFactor', value: THRESHOLDS.runtimeWarningFactor, description: 'Runtime below duration*factor is a warning' },
    { name: 'thermalWarningMarginDegC', value: THRESHOLDS.thermalWarningMarginDegC, unit: 'degC', description: 'Estimated temperature within this margin of the ceiling is a warning' },
  ],
  outputStates: ['pass', 'warning', 'fail', 'unknown', 'error', 'requires_validation'],
  confidenceRules: [
    'insufficient_evidence when any required input is absent or unknown-grade',
    'deterministic_estimated_inputs when any consumed input is an engineering estimate',
    'deterministic_verified_inputs only when all inputs are verified/datasheet/measured grade',
  ],
  evidenceRequirements: [
    'Battery capacity and derating: vendor datasheet or measured discharge curve',
    'Subsystem currents: datasheet or bench measurement',
    'Thermal resistance: measured preferred; datasheet acceptable; estimates cap the result at requires_validation',
  ],
  failureModes: [
    'Runtime below classroom session length',
    'Regulator or charger over-temperature inside closed enclosure',
    'Battery over-discharge below protection floor',
    'Charge-while-operate without load sharing never terminating charge',
  ],
  requiredTestFixtureTypes: [
    'nominal 4-hour classroom session',
    'full-brightness backlight overload',
    'stuck RGB emitter fault',
    'under-capacity battery',
    'missing converter-efficiency input',
    'charging while operating',
    'high-ambient classroom',
    'daughterboard overcurrent',
  ],
  physicalValidationProcedure: [
    'validation-plan test 1: battery runtime test (logged current, full charge to floor)',
    'validation-plan test 2: charger-temperature test (closed enclosure, 40 degC)',
    'validation-plan test 3: maximum-backlight thermal test',
  ],
  limitations: [
    'First-order thermal model only; no transient or convective modelling.',
    'Does not model battery internal resistance or voltage sag under peak load.',
    'Charger thermal path is bounded, not simulated.',
  ],
};

export function evaluate(inputs: PowerThermalInputs): UnhashedRuleResult {
  const missing: MissingInput[] = [];
  const trace: TraceStep[] = [];
  const checks: CheckFinding[] = [];
  const warnings: string[] = [];
  const consumed: Array<Quantity | null | undefined> = [];

  const capacity = resolveQuantity(inputs.battery.nominalCapacity, 'charge_capacity', 'battery.nominalCapacity', missing);
  const derating = resolveQuantity(inputs.battery.deratingFactor, 'ratio', 'battery.deratingFactor', missing);
  const vBatt = resolveQuantity(inputs.battery.nominalVoltage, 'voltage', 'battery.nominalVoltage', missing);
  const dischargeLimit = resolveQuantity(inputs.battery.dischargeLimit, 'voltage', 'battery.dischargeLimit', missing);
  const ambient = resolveQuantity(inputs.ambientTemperature, 'temperature', 'ambientTemperature', missing);
  const tMax = resolveQuantity(inputs.maxComponentTemperature, 'temperature', 'maxComponentTemperature', missing);
  const duration = resolveQuantity(inputs.intendedDuration, 'time', 'intendedDuration', missing);
  consumed.push(
    inputs.battery.nominalCapacity, inputs.battery.deratingFactor, inputs.battery.nominalVoltage,
    inputs.battery.dischargeLimit, inputs.ambientTemperature, inputs.maxComponentTemperature,
    inputs.intendedDuration,
  );

  const vIn = resolveQuantity(inputs.regulator.inputVoltage, 'voltage', 'regulator.inputVoltage', missing);
  const vOut = resolveQuantity(inputs.regulator.outputVoltage, 'voltage', 'regulator.outputVoltage', missing);
  consumed.push(inputs.regulator.inputVoltage, inputs.regulator.outputVoltage);

  // --- F1: duty-weighted average + concurrent peak -------------------------
  let iAvg: number | null = 0;
  let iPeak = 0;
  let i3v3Avg = 0;
  const loadTraceInputs: Record<string, unknown> = {};
  for (const [idx, load] of inputs.loads.entries()) {
    const current = resolveQuantity(load.current, 'current', `loads[${idx}].current`, missing);
    const duty = resolveQuantity(load.duty, 'ratio', `loads[${idx}].duty`, missing);
    consumed.push(load.current, load.duty);
    if (current === null || duty === null) {
      iAvg = null;
      continue;
    }
    if (iAvg !== null) iAvg += current.value * duty.value;
    if (load.peakConcurrent) iPeak += current.value;
    if (load.rail === '3V3') i3v3Avg += current.value * duty.value;
    loadTraceInputs[load.name] = { current_A: current.value, duty: duty.value, rail: load.rail };
  }
  trace.push({
    step: 'average-load', formula: 'F1: I_average = sum(duty_i * I_i)',
    inputs: loadTraceInputs, output: iAvg === null ? null : round(iAvg), unit: 'A',
  });
  trace.push({
    step: 'peak-load', formula: 'I_peak = sum(I_i | peakConcurrent)',
    inputs: loadTraceInputs, output: round(iPeak), unit: 'A',
  });

  // --- F2/F3: usable capacity and runtime ----------------------------------
  let cUsable: number | null = null;
  if (capacity !== null && derating !== null) {
    cUsable = capacity.value * derating.value;
    trace.push({
      step: 'usable-capacity', formula: 'F2: C_usable = C_nominal * derating',
      inputs: { C_nominal_Ah: capacity.value, derating: derating.value },
      output: round(cUsable), unit: 'Ah',
    });
  }
  let runtime: number | null = null;
  if (cUsable !== null && iAvg !== null && iAvg > 0) {
    runtime = cUsable / iAvg;
    trace.push({
      step: 'runtime', formula: 'F3: t_runtime = C_usable / I_average',
      inputs: { C_usable_Ah: round(cUsable), I_average_A: round(iAvg) },
      output: round(runtime), unit: 'h',
    });
  }

  if (runtime === null || duration === null) {
    checks.push({
      check: 'runtime',
      status: 'unknown',
      detail: 'Runtime not computable: required battery/load/duration inputs missing. Missing data is never treated as zero or pass.',
    });
  } else if (runtime < duration.value) {
    checks.push({
      check: 'runtime', status: 'fail',
      detail: `Estimated runtime ${round(runtime, 2)} h is below the intended duration ${duration.value} h.`,
      threshold: duration.value, observed: round(runtime, 4),
    });
  } else if (runtime < duration.value * THRESHOLDS.runtimeWarningFactor) {
    checks.push({
      check: 'runtime', status: 'warning',
      detail: `Estimated runtime ${round(runtime, 2)} h is within ${THRESHOLDS.runtimeWarningFactor}x of the intended duration ${duration.value} h — margin is thin.`,
      threshold: duration.value * THRESHOLDS.runtimeWarningFactor, observed: round(runtime, 4),
    });
  } else {
    checks.push({
      check: 'runtime', status: 'pass',
      detail: `Estimated runtime ${round(runtime, 2)} h exceeds the intended duration ${duration.value} h with margin.`,
      threshold: duration.value, observed: round(runtime, 4),
    });
  }

  // --- F4/F5: regulator dissipation ----------------------------------------
  let pLoss: number | null = null;
  if (inputs.regulator.topology === 'linear-ldo') {
    if (vIn !== null && vOut !== null && iAvg !== null) {
      pLoss = (vIn.value - vOut.value) * i3v3Avg;
      trace.push({
        step: 'regulator-dissipation', formula: 'F4: P = (V_in - V_out) * I_out',
        inputs: { V_in: vIn.value, V_out: vOut.value, I_out_A: round(i3v3Avg) },
        output: round(pLoss), unit: 'W',
      });
    }
  } else {
    const eff = inputs.regulator.efficiency ?? null;
    const effN = resolveQuantity(eff, 'ratio', 'regulator.efficiency', missing);
    consumed.push(eff);
    if (effN !== null && vOut !== null && iAvg !== null) {
      if (effN.value <= 0 || effN.value > 1) {
        checks.push({
          check: 'regulator-efficiency-range', status: 'error',
          detail: `Converter efficiency ${effN.value} outside (0, 1].`, observed: effN.value,
        });
      } else {
        const pOut = vOut.value * i3v3Avg;
        pLoss = pOut * (1 / effN.value - 1);
        trace.push({
          step: 'converter-loss', formula: 'F5: P = P_out * (1/eta - 1)',
          inputs: { P_out_W: round(pOut), eta: effN.value },
          output: round(pLoss), unit: 'W',
        });
      }
    }
  }

  // --- F6: first-order thermal estimate ------------------------------------
  const thetaClass = inputs.regulator.thermalResistanceClass;
  const theta = resolveQuantity(
    inputs.regulator.thermalResistance ?? null, 'thermal_resistance', 'regulator.thermalResistance',
    thetaClass === 'unknown' ? missing : [],
  );
  consumed.push(inputs.regulator.thermalResistance);
  let tEst: number | null = null;
  if (pLoss === null || ambient === null) {
    checks.push({
      check: 'regulator-thermal', status: 'unknown',
      detail: 'Regulator dissipation or ambient temperature not computable; thermal margin unknown.',
    });
  } else if (theta === null || thetaClass === 'unknown') {
    checks.push({
      check: 'regulator-thermal', status: 'unknown',
      detail: 'Thermal resistance unknown — temperature estimate refused rather than guessed (F6 skipped).',
    });
  } else {
    tEst = ambient.value + pLoss * theta.value;
    trace.push({
      step: 'thermal-estimate', formula: 'F6: T_est = T_ambient + P_loss * theta',
      inputs: { T_ambient_degC: ambient.value, P_loss_W: round(pLoss), theta_KperW: theta.value, thetaClass },
      output: round(tEst), unit: 'degC',
    });
    if (tMax === null) {
      checks.push({ check: 'regulator-thermal', status: 'unknown', detail: 'Maximum component temperature missing.' });
    } else if (tEst > tMax.value) {
      checks.push({
        check: 'regulator-thermal', status: 'fail',
        detail: `Estimated regulator temperature ${round(tEst, 1)} degC exceeds the ${tMax.value} degC ceiling (theta class: ${thetaClass}).`,
        threshold: tMax.value, observed: round(tEst, 2),
      });
    } else if (tEst > tMax.value - THRESHOLDS.thermalWarningMarginDegC) {
      checks.push({
        check: 'regulator-thermal', status: 'warning',
        detail: `Estimated regulator temperature ${round(tEst, 1)} degC is within ${THRESHOLDS.thermalWarningMarginDegC} degC of the ceiling (theta class: ${thetaClass}).`,
        threshold: tMax.value, observed: round(tEst, 2),
      });
    } else if (thetaClass === 'estimated') {
      checks.push({
        check: 'regulator-thermal', status: 'requires_validation',
        detail: `Estimated temperature ${round(tEst, 1)} degC has margin, but thermal resistance is an estimate — bench verification required before this can pass (validation-plan tests 2-3).`,
        threshold: tMax.value, observed: round(tEst, 2),
      });
    } else {
      checks.push({
        check: 'regulator-thermal', status: 'pass',
        detail: `Estimated temperature ${round(tEst, 1)} degC within ceiling with ${thetaClass}-grade thermal resistance.`,
        threshold: tMax.value, observed: round(tEst, 2),
      });
    }
  }

  // --- enclosure / touch temperature ---------------------------------------
  if (inputs.enclosureThermalResistanceClass === 'unknown') {
    checks.push({
      check: 'enclosure-thermal', status: 'requires_validation',
      detail: 'Enclosure effective thermal resistance is unknown; enclosure and touchable-surface temperature margins require physical validation (validation-plan tests 2-3).',
    });
  }

  // --- charger --------------------------------------------------------------
  const iCharge = resolveQuantity(inputs.charger.programCurrent ?? null, 'current', 'charger.programCurrent', []);
  if (inputs.charger.chargingWhileOperating) {
    if (iCharge !== null && vBatt !== null) {
      const pCharger = (5.0 - vBatt.value) * iCharge.value;
      trace.push({
        step: 'charger-dissipation-bound', formula: 'F7: P_charger = (V_usb - V_batt) * I_charge',
        inputs: { V_usb: 5.0, V_batt: vBatt.value, I_charge_A: iCharge.value },
        output: round(pCharger), unit: 'W',
      });
    }
    if (!inputs.charger.loadSharingEvidence) {
      checks.push({
        check: 'charge-while-operate', status: 'requires_validation',
        detail: 'Charging while operating is requested but no load-sharing/power-path evidence exists (DEC-002 conditions unmet). Charge termination and cell stress cannot be verified analytically.',
      });
      warnings.push('Charge-while-operate without verified load sharing can prevent charge termination (TP4056-class behavior).');
    } else {
      checks.push({
        check: 'charge-while-operate', status: 'pass',
        detail: 'Load-sharing evidence declared; charge-while-operate accepted analytically (thermal test still listed).',
      });
    }
  }

  // --- battery floor sanity --------------------------------------------------
  if (dischargeLimit !== null && vOut !== null && vIn !== null && dischargeLimit.value < vOut.value) {
    checks.push({
      check: 'discharge-floor-vs-regulator', status: 'warning',
      detail: `Discharge floor ${dischargeLimit.value} V is below the regulator output ${vOut.value} V — the rail will sag out of regulation before the floor is reached (LDO dropout).`,
      threshold: vOut.value, observed: dischargeLimit.value,
    });
  }

  if (missing.length > 0) {
    checks.push({
      check: 'input-completeness', status: 'unknown',
      detail: `Required inputs absent: ${missing.map(m => m.field).sort().join(', ')}. Missing numeric inputs never default to zero.`,
    });
  }

  const metrics: Record<string, number | string | null> = {
    averageCurrent_A: iAvg === null ? null : round(iAvg),
    peakCurrent_A: round(iPeak),
    usableCapacity_Ah: cUsable === null ? null : round(cUsable),
    estimatedRuntime_h: runtime === null ? null : round(runtime),
    runtimeMargin_h: runtime !== null && duration !== null ? round(runtime - duration.value) : null,
    batteryMargin_Ah: cUsable !== null && iAvg !== null && duration !== null ? round(cUsable - iAvg * duration.value) : null,
    regulatorDissipation_W: pLoss === null ? null : round(pLoss),
    estimatedRegulatorTemperature_degC: tEst === null ? null : round(tEst),
    thermalMargin_degC: tEst !== null && tMax !== null ? round(tMax.value - tEst) : null,
    thermalResistanceClass: thetaClass,
  };

  const confidence = deriveConfidence({
    requiredInputGrades: consumed.filter((q): q is Quantity => q != null).map(q => q.evidenceGrade ?? 'unknown'),
    missingRequiredCount: missing.length,
  });

  return buildResult({
    ruleId: RULE_ID,
    ruleVersion: RULE_VERSION,
    inputs: normalizedInputEcho({ capacity, derating, vBatt, dischargeLimit, ambient, tMax, duration, vIn, vOut }),
    inputProvenance: provenanceEcho({
      'battery.nominalCapacity': inputs.battery.nominalCapacity,
      'battery.deratingFactor': inputs.battery.deratingFactor,
      'battery.nominalVoltage': inputs.battery.nominalVoltage,
      'battery.dischargeLimit': inputs.battery.dischargeLimit,
      'ambientTemperature': inputs.ambientTemperature,
      'maxComponentTemperature': inputs.maxComponentTemperature,
      'intendedDuration': inputs.intendedDuration,
      'regulator.inputVoltage': inputs.regulator.inputVoltage,
      'regulator.outputVoltage': inputs.regulator.outputVoltage,
    }),
    assumptions: definition.assumptions,
    procedure: definition.formulas.map(f => `${f.id}: ${f.expression}`),
    trace,
    thresholds: { ...THRESHOLDS },
    checks,
    metrics,
    confidence,
    unknowns: missing,
    warnings,
    failureModes: definition.failureModes,
    requiredTests: [
      'validation-plan test 1: battery runtime test',
      'validation-plan test 2: charger-temperature test',
      'validation-plan test 3: maximum-backlight thermal test',
    ],
    affectedObjects: definition.targetObjects,
    evidenceReferences: [],
  });
}

function normalizedInputEcho(values: Record<string, NormalizedQuantity | null>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = v === null ? null : { value: round(v.value), unit: v.unit };
  }
  return out;
}

function provenanceEcho(values: Record<string, Quantity | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = v?.provenance ?? (v == null ? 'absent' : 'undeclared');
  }
  return out;
}
