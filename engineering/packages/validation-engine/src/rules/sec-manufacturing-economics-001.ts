import type { ManufacturingEconomicsInputs } from '../contracts/rule-inputs.schema.js';
import type { RuleDefinition } from '../contracts/rule-definition.schema.js';
import type { CheckFinding, TraceStep } from '../contracts/rule-result.schema.js';
import { deriveConfidence } from '../confidence.js';
import { resolveQuantity, type MissingInput, type Quantity } from '../units/units.js';
import { buildResult, round, type UnhashedRuleResult } from './shared.js';

export const RULE_ID = 'SEC-MANUFACTURING-ECONOMICS-001';
export const RULE_VERSION = '0.1.0';

const THRESHOLDS = {
  costWarningFactorOverTarget: 1.3,
  grossMarginWarningPercent: 20,
} as const;

/** Inputs that must ALL be present before any margin language is emitted. */
const MARGIN_COMPLETENESS_FIELDS = [
  'assemblyHours', 'laborRate', 'testingHours', 'scrapRate', 'reworkAllowance',
  'packaging', 'warrantyAllowance', 'logisticsAllowance', 'channelMargin', 'taxTreatment',
] as const;

export const definition: RuleDefinition = {
  ruleId: RULE_ID,
  ruleName: 'Manufacturing cost, assembly yield, and commercial feasibility',
  ruleVersion: RULE_VERSION,
  purpose:
    'Determine whether the proposed product can meet the target ex-factory cost and institutional pricing assumptions at the documented manufacturing volume.',
  targetObjects: ['bom:all', 'targets:unitCostExFactory', 'targets:assemblyTime'],
  requiredInputs: [
    { name: 'materialLines[]', unit: 'INR', description: 'Electronic BOM, slate, battery, PCB, hardware, packaging lines' },
    { name: 'filament[]', unit: 'g + INR/kg', description: 'Filament consumption by material' },
    { name: 'failedPrintAllowance', unit: 'fraction|percent', description: 'Failed-print allowance on filament' },
    { name: 'assemblyHours + laborRate', unit: 'h + INR/h', description: 'Assembly labor' },
    { name: 'testingHours', unit: 'h', description: 'Per-unit testing time' },
    { name: 'scrapRate', unit: 'fraction|percent', description: 'Whole-unit scrap rate' },
    { name: 'reworkAllowance', unit: 'fraction|INR', description: 'Rework allowance' },
    { name: 'packaging', unit: 'INR', description: 'Packaging cost' },
    { name: 'targetExFactoryCost', unit: 'INR', description: 'Ex-factory target' },
  ],
  optionalInputs: [
    { name: 'targetSellingPrice + channelMargin + warrantyAllowance + logisticsAllowance + taxTreatment', unit: 'INR / fraction', description: 'Required before ANY margin statement is made' },
    { name: 'printMachineHours + printMachineRate', unit: 'h + INR/h', description: 'Machine time cost' },
    { name: 'procurementVariance', unit: 'fraction', description: 'Material cost uncertainty band' },
    { name: 'productionQuantity', unit: 'count', description: 'Documented manufacturing volume' },
  ],
  formulas: [
    { id: 'E1', expression: 'C_material = sum(lines) + sum(filament_g/1000 * price_per_kg * (1 + failed_print_allowance))', description: 'Material cost' },
    { id: 'E2', expression: 'C_yield_adjusted = C_material / (1 - scrap_rate)', description: 'Yield-adjusted manufacturing cost' },
    { id: 'E3', expression: 'C_assembly = assembly_hours * labor_rate', description: 'Assembly cost' },
    { id: 'E4', expression: 'C_ex_factory = C_yield_adjusted + C_assembly + testing + rework + packaging + overhead + machine_time', description: 'Estimated ex-factory cost' },
    { id: 'E5', expression: 'Contribution = selling_price - C_ex_factory - channel_costs - warranty - logistics', description: 'Gross contribution before tax' },
    { id: 'E6', expression: 'GM% = Contribution / selling_price * 100', description: 'Gross-margin percentage' },
  ],
  deterministicProcedure: [
    'Sum material lines (E1) including yield-loaded filament.',
    'Yield-adjust with the whole-unit scrap rate (E2).',
    'Add assembly, testing, rework, packaging, overhead, machine time (E3, E4).',
    'Emit margin metrics (E5, E6) ONLY when labor, testing, yield, rework, packaging, warranty, logistics, taxes, and channel inputs are all present; otherwise the margin is unknown and the missing fields are listed.',
    'Rank the top three cost drivers; band material cost by the procurement variance.',
  ],
  assumptions: [
    'Rework allowance in INR is absolute; as a fraction it applies to (yield-adjusted material + assembly + testing).',
    'Channel margin as a fraction applies to the selling price.',
    'Single-currency (INR) model; taxes handled as a declared treatment string, not computed.',
  ],
  thresholds: [
    { name: 'costWarningFactorOverTarget', value: THRESHOLDS.costWarningFactorOverTarget, description: 'Ex-factory above target*factor is fail; between target and factor is warning' },
    { name: 'grossMarginWarningPercent', value: THRESHOLDS.grossMarginWarningPercent, unit: 'percent', description: 'GM below this is a warning' },
  ],
  outputStates: ['pass', 'warning', 'fail', 'unknown', 'error', 'requires_validation'],
  confidenceRules: [
    'insufficient_evidence when any required commercial input is absent',
    'deterministic_estimated_inputs when prices are estimates (no vendor quotes in corpus)',
  ],
  evidenceRequirements: [
    'Vendor quotes at the documented volumes (3 / 25 / 100 units)',
    'Measured assembly time (validation-plan test 15)',
    'Measured print time and failure rate across a pilot batch',
  ],
  failureModes: [
    'Material subtotal alone exceeding the ex-factory target',
    'Yield/rework loading turning a paper margin negative',
    'Channel margin consuming the institutional price gap',
  ],
  requiredTestFixtureTypes: [
    'INR 850 reference case',
    'INR 1,100 upper-bound case',
    'writing-slate cost increase',
    'battery cost increase',
    'failed-print rate increase',
    'assembly time exceeding target',
    'low-volume three-unit prototype',
    '25-unit pilot',
    '100-unit small batch',
    'institutional channel margin case',
  ],
  physicalValidationProcedure: ['validation-plan test 15: assembly-time measurement'],
  limitations: [
    'No tax computation — treatment is declared, not modelled.',
    'No cash-flow, MOQ, or inventory modelling.',
    'Margin statements are refused (unknown) when any completeness field is missing — the rule never describes a margin as extreme or attractive on partial costs.',
  ],
};

export function evaluate(inputs: ManufacturingEconomicsInputs): UnhashedRuleResult {
  const missing: MissingInput[] = [];
  const trace: TraceStep[] = [];
  const checks: CheckFinding[] = [];
  const warnings: string[] = [];
  const consumed: Array<Quantity | null | undefined> = [];

  const inr = (q: Quantity | null | undefined, field: string) => {
    consumed.push(q);
    return resolveQuantity(q ?? null, 'currency_inr', field, missing);
  };
  const frac = (q: Quantity | null | undefined, field: string) => {
    consumed.push(q);
    return resolveQuantity(q ?? null, 'ratio', field, missing);
  };
  const hours = (q: Quantity | null | undefined, field: string) => {
    consumed.push(q);
    return resolveQuantity(q ?? null, 'time', field, missing);
  };

  // E1: material
  let materialSubtotal = 0;
  const lineCosts: Array<{ name: string; cost: number }> = [];
  for (const [idx, line] of inputs.materialLines.entries()) {
    const c = inr(line.cost, `materialLines[${idx}].cost`);
    if (c !== null) {
      materialSubtotal += c.value;
      lineCosts.push({ name: line.name, cost: c.value });
    }
  }
  const failedPrint = frac(inputs.failedPrintAllowance, 'failedPrintAllowance');
  let filamentCost: number | null = 0;
  for (const [idx, fil] of inputs.filament.entries()) {
    const grams = resolveQuantity(fil.grams, 'mass', `filament[${idx}].grams`, missing);
    const price = inr(fil.pricePerKg, `filament[${idx}].pricePerKg`);
    consumed.push(fil.grams);
    if (grams === null || price === null || failedPrint === null) {
      filamentCost = null;
      continue;
    }
    const cost = (grams.value / 1000) * price.value * (1 + failedPrint.value);
    if (filamentCost !== null) filamentCost += cost;
    lineCosts.push({ name: `filament:${fil.material}`, cost: round(cost, 2) });
  }
  const cMaterial = filamentCost === null ? null : materialSubtotal + filamentCost;
  trace.push({
    step: 'material-cost', formula: 'E1',
    inputs: { lineSubtotal_INR: round(materialSubtotal, 2), filament_INR: filamentCost === null ? null : round(filamentCost, 2), failedPrintAllowance: failedPrint?.value ?? null },
    output: cMaterial === null ? null : round(cMaterial, 2), unit: 'INR',
  });

  // E2: yield adjustment
  const scrap = frac(inputs.scrapRate, 'scrapRate');
  let cYield: number | null = null;
  if (cMaterial !== null && scrap !== null) {
    if (scrap.value >= 1 || scrap.value < 0) {
      checks.push({ check: 'scrap-rate-range', status: 'error', detail: `Scrap rate ${scrap.value} outside [0, 1).`, observed: scrap.value });
    } else {
      cYield = cMaterial / (1 - scrap.value);
      trace.push({ step: 'yield-adjusted-cost', formula: 'E2', inputs: { C_material: round(cMaterial, 2), scrapRate: scrap.value }, output: round(cYield, 2), unit: 'INR' });
    }
  }

  // E3: assembly + testing + machine time
  const asmH = hours(inputs.assemblyHours, 'assemblyHours');
  const labor = inr(inputs.laborRate, 'laborRate');
  const testH = hours(inputs.testingHours, 'testingHours');
  const cAssembly = asmH !== null && labor !== null ? asmH.value * labor.value : null;
  const cTesting = testH !== null && labor !== null ? testH.value * labor.value : null;
  if (cAssembly !== null) {
    trace.push({ step: 'assembly-cost', formula: 'E3', inputs: { assemblyHours: asmH!.value, laborRate_INR_h: labor!.value }, output: round(cAssembly, 2), unit: 'INR' });
  }
  const machH = inputs.printMachineHours !== null ? hours(inputs.printMachineHours, 'printMachineHours') : null;
  const machRate = inputs.printMachineRate !== null ? inr(inputs.printMachineRate, 'printMachineRate') : null;
  const cMachine = machH !== null && machRate !== null ? machH.value * machRate.value : null;

  // rework: INR absolute or fraction of (yield-adjusted + assembly + testing)
  consumed.push(inputs.reworkAllowance);
  let cRework: number | null = null;
  if (inputs.reworkAllowance === null) {
    missing.push({ field: 'reworkAllowance', reason: 'required allowance absent' });
  } else if (inputs.reworkAllowance.unit === 'INR') {
    cRework = inputs.reworkAllowance.value;
  } else {
    const rw = frac(inputs.reworkAllowance, 'reworkAllowance');
    if (rw !== null && cYield !== null && cAssembly !== null && cTesting !== null) {
      cRework = rw.value * (cYield + cAssembly + cTesting);
    }
  }

  const cPackaging = inr(inputs.packaging, 'packaging');
  const cConsumables = inputs.assemblyConsumables !== null ? inr(inputs.assemblyConsumables, 'assemblyConsumables') : null;
  const cOverhead = inputs.manufacturingOverhead !== null ? inr(inputs.manufacturingOverhead, 'manufacturingOverhead') : null;

  // E4: ex-factory
  let cExFactory: number | null = null;
  if (cYield !== null && cAssembly !== null && cTesting !== null && cRework !== null && cPackaging !== null) {
    cExFactory = cYield + cAssembly + cTesting + cRework + cPackaging.value +
      (cMachine ?? 0) + (cConsumables?.value ?? 0) + (cOverhead?.value ?? 0);
    trace.push({
      step: 'ex-factory-cost', formula: 'E4',
      inputs: {
        C_yield_adjusted: round(cYield, 2), C_assembly: round(cAssembly, 2), testing: round(cTesting, 2),
        rework: round(cRework, 2), packaging: cPackaging.value,
        machineTime: cMachine === null ? 'not declared (0 contribution recorded explicitly)' : round(cMachine, 2),
        consumables: cConsumables?.value ?? 'not declared (0 contribution recorded explicitly)',
        overhead: cOverhead?.value ?? 'not declared (0 contribution recorded explicitly)',
      },
      output: round(cExFactory, 2), unit: 'INR',
    });
    if (cMachine === null) warnings.push('Print machine time cost not declared — ex-factory cost excludes machine time and is optimistic.');
    if (cOverhead === null) warnings.push('Manufacturing overhead not declared — ex-factory cost excludes overhead and is optimistic.');
  }

  // cost target check
  const target = inr(inputs.targetExFactoryCost, 'targetExFactoryCost');
  if (cExFactory === null || target === null) {
    checks.push({ check: 'ex-factory-cost', status: 'unknown', detail: 'Ex-factory cost or target not computable from declared inputs — missing inputs listed; nothing defaulted to zero.' });
  } else if (cExFactory <= target.value) {
    checks.push({ check: 'ex-factory-cost', status: 'pass', detail: `Estimated ex-factory INR ${round(cExFactory, 0)} within target INR ${target.value}.`, threshold: target.value, observed: round(cExFactory, 2) });
  } else if (cExFactory <= target.value * THRESHOLDS.costWarningFactorOverTarget) {
    checks.push({ check: 'ex-factory-cost', status: 'warning', detail: `Estimated ex-factory INR ${round(cExFactory, 0)} exceeds the INR ${target.value} target but is within ${THRESHOLDS.costWarningFactorOverTarget}x.`, threshold: target.value, observed: round(cExFactory, 2) });
  } else {
    checks.push({ check: 'ex-factory-cost', status: 'fail', detail: `Estimated ex-factory INR ${round(cExFactory, 0)} exceeds ${THRESHOLDS.costWarningFactorOverTarget}x the INR ${target.value} target.`, threshold: round(target.value * THRESHOLDS.costWarningFactorOverTarget, 2), observed: round(cExFactory, 2) });
  }

  // margin completeness gate
  const completeness: string[] = [];
  if (inputs.assemblyHours === null) completeness.push('assemblyHours');
  if (inputs.laborRate === null) completeness.push('laborRate');
  if (inputs.testingHours === null) completeness.push('testingHours');
  if (inputs.scrapRate === null) completeness.push('scrapRate');
  if (inputs.reworkAllowance === null) completeness.push('reworkAllowance');
  if (inputs.packaging === null) completeness.push('packaging');
  if (inputs.warrantyAllowance === null) completeness.push('warrantyAllowance');
  if (inputs.logisticsAllowance === null) completeness.push('logisticsAllowance');
  if (inputs.channelMargin === null) completeness.push('channelMargin');
  if (inputs.taxTreatment === null) completeness.push('taxTreatment');

  // E5/E6: contribution + GM — only with full completeness
  let contribution: number | null = null;
  let gmPercent: number | null = null;
  const selling = inputs.targetSellingPrice !== null ? inr(inputs.targetSellingPrice, 'targetSellingPrice') : null;
  if (completeness.length > 0) {
    checks.push({
      check: 'margin-statement', status: 'unknown',
      detail: `Margin is NOT stated: required commercial inputs missing (${completeness.sort().join(', ')}). The rule never describes margins without labor, testing, yield, rework, packaging, warranty, logistics, tax, and channel inputs.`,
      observed: completeness.sort(),
    });
  } else if (selling !== null && cExFactory !== null) {
    const warranty = inr(inputs.warrantyAllowance, 'warrantyAllowance');
    const logistics = inr(inputs.logisticsAllowance, 'logisticsAllowance');
    const channel = frac(inputs.channelMargin, 'channelMargin');
    if (warranty !== null && logistics !== null && channel !== null) {
      const channelCost = selling.value * channel.value;
      contribution = selling.value - cExFactory - channelCost - warranty.value - logistics.value;
      gmPercent = (contribution / selling.value) * 100;
      trace.push({
        step: 'contribution', formula: 'E5, E6',
        inputs: { sellingPrice: selling.value, C_ex_factory: round(cExFactory, 2), channelCost: round(channelCost, 2), warranty: warranty.value, logistics: logistics.value, taxTreatment: inputs.taxTreatment },
        output: { contribution_INR: round(contribution, 2), grossMargin_percent: round(gmPercent, 2) },
      });
      if (contribution <= 0) {
        checks.push({ check: 'margin-statement', status: 'fail', detail: `Contribution INR ${round(contribution, 0)} is non-positive at selling price INR ${selling.value} (tax treatment: ${inputs.taxTreatment}).`, observed: round(contribution, 2) });
      } else if (gmPercent < THRESHOLDS.grossMarginWarningPercent) {
        checks.push({ check: 'margin-statement', status: 'warning', detail: `Gross margin ${round(gmPercent, 1)}% below ${THRESHOLDS.grossMarginWarningPercent}% after channel, warranty, and logistics (tax treatment: ${inputs.taxTreatment}).`, threshold: THRESHOLDS.grossMarginWarningPercent, observed: round(gmPercent, 2) });
      } else {
        checks.push({ check: 'margin-statement', status: 'pass', detail: `Gross margin ${round(gmPercent, 1)}% with all completeness fields present (tax treatment: ${inputs.taxTreatment}).`, threshold: THRESHOLDS.grossMarginWarningPercent, observed: round(gmPercent, 2) });
      }
    }
  } else {
    checks.push({ check: 'margin-statement', status: 'unknown', detail: 'Selling price or ex-factory cost unavailable — no margin stated.' });
  }

  // uncertainty band + drivers
  const variance = inputs.procurementVariance !== null ? frac(inputs.procurementVariance, 'procurementVariance') : null;
  let costLow: number | null = null;
  let costHigh: number | null = null;
  if (variance !== null && cExFactory !== null && cMaterial !== null) {
    costLow = cExFactory - cMaterial * variance.value;
    costHigh = cExFactory + cMaterial * variance.value;
  } else if (cExFactory !== null) {
    warnings.push('Procurement variance not declared — no cost uncertainty band computed.');
  }
  const drivers = [...lineCosts, ...(cAssembly !== null ? [{ name: 'assembly-labor', cost: round(cAssembly, 2) }] : [])]
    .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name))
    .slice(0, 3);
  trace.push({ step: 'cost-drivers', inputs: { lineCount: lineCosts.length }, output: drivers });

  if (missing.length > 0) {
    checks.push({
      check: 'input-completeness', status: 'unknown',
      detail: `Missing commercial inputs: ${[...new Set(missing.map(m => m.field))].sort().join(', ')}.`,
    });
  }
  if (inputs.productionQuantity === null) {
    warnings.push('Production quantity undeclared — costs cannot be tied to a documented manufacturing volume.');
  }

  const confidence = deriveConfidence({
    requiredInputGrades: consumed.filter((q): q is Quantity => q != null).map(q => q.evidenceGrade ?? 'unknown'),
    missingRequiredCount: missing.length,
  });

  return buildResult({
    ruleId: RULE_ID,
    ruleVersion: RULE_VERSION,
    inputs: {
      materialLineCount: inputs.materialLines.length,
      filamentMaterials: inputs.filament.map(f => f.material).sort(),
      productionQuantity: inputs.productionQuantity,
      taxTreatment: inputs.taxTreatment,
    },
    inputProvenance: {
      materialLines: inputs.materialLines[0]?.cost.provenance ?? 'absent',
      targetExFactoryCost: inputs.targetExFactoryCost?.provenance ?? 'absent',
    },
    assumptions: definition.assumptions,
    procedure: definition.formulas.map(f => `${f.id}: ${f.expression}`),
    trace,
    thresholds: { ...THRESHOLDS },
    checks,
    metrics: {
      bomSubtotal_INR: round(materialSubtotal, 2),
      printMaterialCost_INR: filamentCost === null ? null : round(filamentCost, 2),
      printTimeCost_INR: cMachine === null ? null : round(cMachine, 2),
      assemblyCost_INR: cAssembly === null ? null : round(cAssembly, 2),
      testCost_INR: cTesting === null ? null : round(cTesting, 2),
      yieldAdjustedCost_INR: cYield === null ? null : round(cYield, 2),
      estimatedExFactoryCost_INR: cExFactory === null ? null : round(cExFactory, 2),
      contributionMargin_INR: contribution === null ? null : round(contribution, 2),
      grossMargin_percent: gmPercent === null ? null : round(gmPercent, 2),
      costUncertaintyLow_INR: costLow === null ? null : round(costLow, 2),
      costUncertaintyHigh_INR: costHigh === null ? null : round(costHigh, 2),
      topCostDrivers: drivers.map(d => `${d.name}=INR ${round(d.cost, 0)}`).join('; '),
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

export { MARGIN_COMPLETENESS_FIELDS };
