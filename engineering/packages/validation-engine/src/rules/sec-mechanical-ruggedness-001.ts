import type { MechanicalRuggednessInputs } from '../contracts/rule-inputs.schema.js';
import type { RuleDefinition } from '../contracts/rule-definition.schema.js';
import type { CheckFinding, TraceStep } from '../contracts/rule-result.schema.js';
import { deriveConfidence } from '../confidence.js';
import { resolveQuantity, type MissingInput, type NormalizedQuantity, type Quantity } from '../units/units.js';
import { buildResult, round, type UnhashedRuleResult } from './shared.js';

export const RULE_ID = 'SEC-MECHANICAL-RUGGEDNESS-001';
export const RULE_VERSION = '0.1.0';

const THRESHOLDS = {
  minAssemblyClearance_mm: 0.3,
  slateRattleClearance_mm: 3.0,
} as const;

export const definition: RuleDefinition = {
  ruleId: RULE_ID,
  ruleName: 'Enclosure, tolerance, and classroom ruggedness',
  ruleVersion: RULE_VERSION,
  purpose:
    'Determine whether the printed enclosure can contain and protect the slate, electronics, diffuser, optical wells, daughterboard, fasteners, wiring paths, bumpers, and carry strap within the intended manufacturing process.',
  targetObjects: ['mechanical:enclosure', 'mechanical:diffuser', 'mechanical:bumpers', 'mechanical:wiring-channels', 'humanInterface:writingSlate', 'optical:token-wells'],
  requiredInputs: [
    { name: 'printer envelope + nozzle + layer height + material + orientation', unit: 'mm / enum', description: 'Manufacturing process' },
    { name: 'enclosure part dimensions + wall/floor thickness', unit: 'mm', description: 'Structural geometry' },
    { name: 'slate dimensions + tolerance + pocket + clearances', unit: 'mm', description: 'Slate fit stack' },
    { name: 'token + well geometry + clearances', unit: 'mm', description: 'Token fit stack' },
    { name: 'screw + boss geometry', unit: 'mm', description: 'Fastening rule inputs' },
    { name: 'wiring groove + conductor geometry', unit: 'mm', description: 'Wiring retention and spacing' },
  ],
  optionalInputs: [
    { name: 'expectedTorque', unit: 'N*m equivalent (declared)', description: 'Expected screw torque (physical test required regardless)' },
    { name: 'targetDropHeight', unit: 'mm|m', description: 'Target drop height (always requires physical validation)' },
  ],
  formulas: [
    { id: 'M1', expression: 'part_xyz <= envelope_xyz', description: 'Print envelope fit' },
    { id: 'M2', expression: 'worst_clearance = pocket - slate - slate_tol - print_tol >= required_removal_clearance', description: 'Slate fit tolerance stack' },
    { id: 'M3', expression: 'well_dia - token_dia - 2*print_tol >= min_clearance', description: 'Token jam stack' },
    { id: 'M4', expression: 'boss_wall = (boss_OD - pilot_dia) / 2 >= min_boss_wall', description: 'Screw-boss rule' },
    { id: 'M5', expression: 'groove_width >= conductor_dia AND spacing >= min_spacing', description: 'Wiring groove rule' },
    { id: 'M6', expression: 'wall >= process_min (fail) / structural_min (warning)', description: 'Wall thickness rule' },
  ],
  deterministicProcedure: [
    'Normalize all lengths to millimetres.',
    'Evaluate M1..M6 tolerance stacks; each missing dimension is a MissingInput, never zero.',
    'PLA structural material always yields a thermal-creep warning for 40 degC classrooms.',
    'Strap anchors and drop resistance are ALWAYS requires_validation until physical tests exist — no analytic pass is possible.',
  ],
  assumptions: [
    'Worst-case linear tolerance stacking (no RSS statistics at v0.1 volumes).',
    'Print tolerance figures represent the calibrated printer/material pair.',
    'Layer adhesion is the weak direction for screw loads.',
  ],
  thresholds: [
    { name: 'minAssemblyClearance_mm', value: THRESHOLDS.minAssemblyClearance_mm, unit: 'mm', description: 'Minimum assembly clearance' },
    { name: 'slateRattleClearance_mm', value: THRESHOLDS.slateRattleClearance_mm, unit: 'mm', description: 'Nominal clearance above this warns of rattle' },
  ],
  outputStates: ['pass', 'warning', 'fail', 'unknown', 'error', 'requires_validation'],
  confidenceRules: [
    'heuristic for boss/orientation checks: bounded rules not yet physically validated',
    'insufficient_evidence when tolerance-stack dimensions are missing',
  ],
  evidenceRequirements: [
    'Measured print tolerances for the calibrated printer/material pair',
    'Vendor drawing for the slate module',
    'Torque and drop test records (validation-plan tests 11, 14)',
  ],
  failureModes: [
    'Slate jams or rattles in pocket',
    'Token wedges in well under tolerance stack',
    'Screw boss splits along layer lines',
    'Conductors escape grooves and short',
    'PLA creep in hot classroom deforms pockets',
    'Strap anchor tears out at carry load',
  ],
  requiredTestFixtureTypes: [
    'nominal PETG enclosure',
    'PLA thermal-creep warning',
    'undersized slate pocket',
    'excessive press fit',
    'insufficient token clearance',
    'weak screw boss',
    'screw load across weak layer orientation',
    'wiring-groove short-circuit risk',
    'blocked diffuser',
    'strap-anchor overload',
    'enclosure exceeding Bambu A1 build volume',
  ],
  physicalValidationProcedure: [
    'validation-plan test 11: screw-boss torque test',
    'validation-plan test 12: slate insertion/removal cycling',
    'validation-plan test 13: wiring-groove retention test',
    'validation-plan test 14: controlled drop test',
  ],
  limitations: [
    'No FEA; linear worst-case stacks only.',
    'Drop performance cannot be predicted analytically at this fidelity — always requires physical test.',
  ],
};

export function evaluate(inputs: MechanicalRuggednessInputs): UnhashedRuleResult {
  const missing: MissingInput[] = [];
  const trace: TraceStep[] = [];
  const checks: CheckFinding[] = [];
  const warnings: string[] = [];
  const consumed: Array<Quantity | null | undefined> = [];

  const len = (q: Quantity | null | undefined, field: string): NormalizedQuantity | null => {
    consumed.push(q);
    return resolveQuantity(q ?? null, 'length', field, missing);
  };

  // M1: print envelope
  const envX = len(inputs.printer.envelopeX, 'printer.envelopeX');
  const envY = len(inputs.printer.envelopeY, 'printer.envelopeY');
  const envZ = len(inputs.printer.envelopeZ, 'printer.envelopeZ');
  const partX = len(inputs.enclosure.largestPartX, 'enclosure.largestPartX');
  const partY = len(inputs.enclosure.largestPartY, 'enclosure.largestPartY');
  const partZ = len(inputs.enclosure.largestPartZ, 'enclosure.largestPartZ');
  if (envX && envY && envZ && partX && partY && partZ) {
    const fits = partX.value <= envX.value && partY.value <= envY.value && partZ.value <= envZ.value;
    trace.push({
      step: 'print-envelope', formula: 'M1',
      inputs: { part: [partX.value, partY.value, partZ.value], envelope: [envX.value, envY.value, envZ.value] },
      output: fits, unit: 'mm',
    });
    checks.push(fits
      ? { check: 'print-envelope', status: 'pass', detail: `Largest part ${partX.value}x${partY.value}x${partZ.value} mm fits ${inputs.printer.type} envelope.` }
      : { check: 'print-envelope', status: 'fail', detail: `Largest part ${partX.value}x${partY.value}x${partZ.value} mm exceeds the ${inputs.printer.type} envelope ${envX.value}x${envY.value}x${envZ.value} mm.` });
  } else {
    checks.push({ check: 'print-envelope', status: 'unknown', detail: 'Envelope or part dimensions missing.' });
  }

  // M2: slate fit
  const s = inputs.slate;
  const slateW = len(s.width, 'slate.width');
  const slateH = len(s.height, 'slate.height');
  const slateTol = len(s.tolerance, 'slate.tolerance');
  const pocketW = len(s.pocketWidth, 'slate.pocketWidth');
  const pocketH = len(s.pocketHeight, 'slate.pocketHeight');
  const removal = len(s.requiredRemovalClearance, 'slate.requiredRemovalClearance');
  const printTol = len(s.printTolerance, 'slate.printTolerance');
  if (slateW && slateH && slateTol && pocketW && pocketH && removal && printTol) {
    const worstW = pocketW.value - slateW.value - slateTol.value - printTol.value;
    const worstH = pocketH.value - slateH.value - slateTol.value - printTol.value;
    const nominalW = pocketW.value - slateW.value;
    trace.push({
      step: 'slate-fit', formula: 'M2',
      inputs: { pocketW: pocketW.value, slateW: slateW.value, slateTol: slateTol.value, printTol: printTol.value },
      output: { worstClearanceW: round(worstW), worstClearanceH: round(worstH) }, unit: 'mm',
    });
    if (worstW < 0 || worstH < 0) {
      checks.push({ check: 'slate-fit', status: 'fail', detail: `Slate pocket jams in worst case (clearance W ${round(worstW, 3)} mm, H ${round(worstH, 3)} mm < 0) — undersized pocket / excessive press fit.`, observed: { worstW: round(worstW, 3), worstH: round(worstH, 3) } });
    } else if (worstW < removal.value || worstH < removal.value) {
      checks.push({ check: 'slate-fit', status: 'warning', detail: `Worst-case slate clearance (W ${round(worstW, 3)} / H ${round(worstH, 3)} mm) is below the required removal clearance ${removal.value} mm.`, threshold: removal.value, observed: { worstW: round(worstW, 3), worstH: round(worstH, 3) } });
    } else if (nominalW > THRESHOLDS.slateRattleClearance_mm) {
      checks.push({ check: 'slate-fit', status: 'warning', detail: `Nominal slate clearance ${round(nominalW, 3)} mm exceeds ${THRESHOLDS.slateRattleClearance_mm} mm — rattle and wear risk.`, threshold: THRESHOLDS.slateRattleClearance_mm, observed: round(nominalW, 3) });
    } else {
      checks.push({ check: 'slate-fit', status: 'pass', detail: `Slate fits with worst-case clearance W ${round(worstW, 3)} / H ${round(worstH, 3)} mm >= removal clearance ${removal.value} mm.` });
    }
  } else {
    checks.push({ check: 'slate-fit', status: 'unknown', detail: 'Slate/pocket tolerance-stack dimensions incomplete.' });
  }

  // M3: token jam
  const t = inputs.token;
  const tokenDia = len(t.diameter, 'token.diameter');
  const wellDia = len(t.wellDiameter, 'token.wellDiameter');
  const tokenMin = len(t.minClearance, 'token.minClearance');
  const tokenPrintTol = len(t.printTolerance, 'token.printTolerance');
  if (tokenDia && wellDia && tokenMin && tokenPrintTol) {
    const clearance = wellDia.value - tokenDia.value - 2 * tokenPrintTol.value;
    trace.push({ step: 'token-clearance', formula: 'M3', inputs: { wellDia: wellDia.value, tokenDia: tokenDia.value, printTol: tokenPrintTol.value }, output: round(clearance), unit: 'mm' });
    checks.push(clearance >= tokenMin.value
      ? { check: 'token-clearance', status: 'pass', detail: `Worst-case token clearance ${round(clearance, 3)} mm >= minimum ${tokenMin.value} mm.`, threshold: tokenMin.value, observed: round(clearance, 3) }
      : { check: 'token-clearance', status: 'fail', detail: `Worst-case token clearance ${round(clearance, 3)} mm is below the minimum ${tokenMin.value} mm — tokens can jam under the tolerance stack.`, threshold: tokenMin.value, observed: round(clearance, 3) });
  } else {
    checks.push({ check: 'token-clearance', status: 'unknown', detail: 'Token/well tolerance-stack dimensions incomplete.' });
  }

  // optical well ambient isolation
  if (t.ambientLightBlocked === true) {
    checks.push({ check: 'optical-well-isolation', status: 'pass', detail: 'Well geometry blocks direct ambient-light paths as designed.' });
  } else if (t.ambientLightBlocked === false) {
    checks.push({ check: 'optical-well-isolation', status: 'fail', detail: 'Direct ambient-light path into the well exists — optical classification envelope is violated by geometry.' });
  } else {
    checks.push({ check: 'optical-well-isolation', status: 'requires_validation', detail: 'Ambient-light isolation undetermined — verify by physical light-leak inspection.' });
  }

  // diffuser
  const dif = inputs.diffuser;
  const difT = len(dif.thickness, 'diffuser.thickness');
  const difMin = len(dif.minSupportableThickness, 'diffuser.minSupportableThickness');
  if (dif.blocked === true) {
    checks.push({ check: 'diffuser', status: 'fail', detail: 'Diffuser is blocked — backlit template area non-functional.' });
  } else if (difT && difMin) {
    checks.push(difT.value >= difMin.value
      ? { check: 'diffuser', status: 'pass', detail: `Diffuser ${difT.value} mm >= supportable minimum ${difMin.value} mm.`, threshold: difMin.value, observed: difT.value }
      : { check: 'diffuser', status: 'fail', detail: `Diffuser ${difT.value} mm is below the mechanically supportable minimum ${difMin.value} mm.`, threshold: difMin.value, observed: difT.value });
  } else {
    checks.push({ check: 'diffuser', status: 'unknown', detail: 'Diffuser thickness inputs incomplete.' });
  }

  // M6: wall thickness
  const wall = len(inputs.enclosure.wallThickness, 'enclosure.wallThickness');
  const wallProcMin = len(inputs.enclosure.minWallThicknessProcess, 'enclosure.minWallThicknessProcess');
  const wallStructMin = len(inputs.enclosure.minStructuralWallThickness, 'enclosure.minStructuralWallThickness');
  if (wall && wallProcMin && wallStructMin) {
    if (wall.value < wallProcMin.value) {
      checks.push({ check: 'wall-thickness', status: 'fail', detail: `Wall ${wall.value} mm below process minimum ${wallProcMin.value} mm.`, threshold: wallProcMin.value, observed: wall.value });
    } else if (wall.value < wallStructMin.value) {
      checks.push({ check: 'wall-thickness', status: 'warning', detail: `Wall ${wall.value} mm printable but below structural minimum ${wallStructMin.value} mm.`, threshold: wallStructMin.value, observed: wall.value });
    } else {
      checks.push({ check: 'wall-thickness', status: 'pass', detail: `Wall ${wall.value} mm meets structural minimum ${wallStructMin.value} mm.`, threshold: wallStructMin.value, observed: wall.value });
    }
  } else {
    checks.push({ check: 'wall-thickness', status: 'unknown', detail: 'Wall thickness inputs incomplete.' });
  }

  // M4: screw boss
  const f = inputs.fastening;
  const bossOD = len(f.bossOuterDiameter, 'fastening.bossOuterDiameter');
  const pilot = len(f.bossPilotDiameter, 'fastening.bossPilotDiameter');
  const minBossWall = len(f.minBossWall, 'fastening.minBossWall');
  if (bossOD && pilot && minBossWall) {
    const bossWall = (bossOD.value - pilot.value) / 2;
    trace.push({ step: 'screw-boss', formula: 'M4', inputs: { bossOD: bossOD.value, pilot: pilot.value }, output: round(bossWall), unit: 'mm' });
    checks.push(bossWall >= minBossWall.value
      ? { check: 'screw-boss', status: 'pass', detail: `Boss wall ${round(bossWall, 3)} mm >= minimum ${minBossWall.value} mm (torque limit still requires physical test 11).`, threshold: minBossWall.value, observed: round(bossWall, 3) }
      : { check: 'screw-boss', status: 'fail', detail: `Boss wall ${round(bossWall, 3)} mm below minimum ${minBossWall.value} mm — boss splits under thread-forming load.`, threshold: minBossWall.value, observed: round(bossWall, 3) });
  } else {
    checks.push({ check: 'screw-boss', status: 'unknown', detail: 'Screw-boss geometry incomplete.' });
  }

  // layer orientation
  if (inputs.printOrientation.screwLoadAcrossLayers === true) {
    checks.push({ check: 'layer-orientation', status: 'warning', detail: 'Screw load acts across layer lines (weak orientation) — reorient part or accept reduced strength; physical torque test mandatory.' });
  } else if (inputs.printOrientation.screwLoadAcrossLayers === null) {
    checks.push({ check: 'layer-orientation', status: 'unknown', detail: 'Print orientation vs load direction undeclared.' });
  } else {
    checks.push({ check: 'layer-orientation', status: 'pass', detail: 'Screw loads act along layer planes (strong orientation).' });
  }

  // M5: wiring
  const w = inputs.wiring;
  const groove = len(w.grooveWidth, 'wiring.grooveWidth');
  const cond = len(w.conductorDiameter, 'wiring.conductorDiameter');
  const minSpace = len(w.minConductorSpacing, 'wiring.minConductorSpacing');
  const actSpace = len(w.actualConductorSpacing, 'wiring.actualConductorSpacing');
  if (groove && cond && minSpace && actSpace) {
    const fitsGroove = groove.value >= cond.value;
    const spacingOk = actSpace.value >= minSpace.value;
    if (!fitsGroove) {
      checks.push({ check: 'wiring-groove', status: 'fail', detail: `Groove ${groove.value} mm narrower than conductor ${cond.value} mm.`, threshold: cond.value, observed: groove.value });
    } else if (!spacingOk) {
      checks.push({ check: 'wiring-groove', status: 'fail', detail: `Conductor spacing ${actSpace.value} mm below minimum ${minSpace.value} mm — overlap/short-circuit risk.`, threshold: minSpace.value, observed: actSpace.value });
    } else {
      checks.push({ check: 'wiring-groove', status: 'pass', detail: `Groove ${groove.value} mm retains ${cond.value} mm conductor; spacing ${actSpace.value} mm >= ${minSpace.value} mm.` });
    }
  } else {
    checks.push({ check: 'wiring-groove', status: 'unknown', detail: 'Wiring groove/conductor dimensions incomplete.' });
  }
  if (w.retentionWithoutGlue === false) {
    checks.push({ check: 'wiring-retention', status: 'fail', detail: 'Wiring retention relies on glue — grooves must retain conductors mechanically.' });
  } else if (w.retentionWithoutGlue === null) {
    checks.push({ check: 'wiring-retention', status: 'requires_validation', detail: 'Glue-free retention undetermined — validation-plan test 13.' });
  } else {
    checks.push({ check: 'wiring-retention', status: 'pass', detail: 'Grooves retain conductors without glue by design (test 13 still required for vibration).' });
  }
  if (w.conductorsInsulated === false) {
    checks.push({ check: 'wiring-insulation', status: 'fail', detail: 'Bare conductors in wiring channels — prohibited (con-sec-no-bare-conductors).' });
  }

  // bumpers
  if (inputs.bumpers.geometryBlocksAssembly === true) {
    checks.push({ check: 'bumpers', status: 'fail', detail: 'TPU bumper geometry blocks assembly.' });
  } else if (inputs.bumpers.geometryBlocksAssembly === null) {
    checks.push({ check: 'bumpers', status: 'unknown', detail: 'Bumper/assembly interaction undeclared.' });
  } else {
    checks.push({ check: 'bumpers', status: 'pass', detail: 'Bumper geometry compatible with assembly.' });
  }

  // strap + drop: never analytic pass
  if (inputs.strap.anchorsPresent === true && !inputs.strap.anchorLoadTested) {
    checks.push({ check: 'strap-anchors', status: 'requires_validation', detail: 'Strap anchors are not accepted without physical load testing — no analytic pass exists for this check.' });
  } else if (inputs.strap.anchorsPresent === true && inputs.strap.anchorLoadTested) {
    checks.push({ check: 'strap-anchors', status: 'pass', detail: 'Strap anchors have physical load-test evidence.' });
  }
  if (!inputs.product.dropTested) {
    checks.push({ check: 'drop-resistance', status: 'requires_validation', detail: 'Drop resistance remains requires_validation until controlled drop tests exist (validation-plan test 14).' });
  }

  // material
  if (inputs.material.structural === 'PLA') {
    checks.push({ check: 'material-thermal-creep', status: 'warning', detail: 'PLA structural body creeps at 40 degC classroom temperatures — PETG is the frozen reference; PLA only with this warning.' });
  } else {
    checks.push({ check: 'material-thermal-creep', status: 'pass', detail: `${inputs.material.structural} structural body acceptable for 40 degC ambient.` });
  }

  // assembly clearance
  const asm = len(inputs.product.assemblyClearance, 'product.assemblyClearance');
  if (asm) {
    checks.push(asm.value >= THRESHOLDS.minAssemblyClearance_mm
      ? { check: 'assembly-clearance', status: 'pass', detail: `Assembly clearance ${asm.value} mm >= ${THRESHOLDS.minAssemblyClearance_mm} mm.`, threshold: THRESHOLDS.minAssemblyClearance_mm, observed: asm.value }
      : { check: 'assembly-clearance', status: 'warning', detail: `Assembly clearance ${asm.value} mm below ${THRESHOLDS.minAssemblyClearance_mm} mm — forced assembly risk.`, threshold: THRESHOLDS.minAssemblyClearance_mm, observed: asm.value });
  } else {
    checks.push({ check: 'assembly-clearance', status: 'unknown', detail: 'Assembly clearance undeclared.' });
  }

  if (missing.length > 0) {
    checks.push({
      check: 'input-completeness', status: 'unknown',
      detail: `Required dimensions absent: ${[...new Set(missing.map(m => m.field))].sort().join(', ')}. Missing dimensions never default to zero.`,
    });
  }

  const confidence = deriveConfidence({
    requiredInputGrades: consumed.filter((q): q is Quantity => q != null).map(q => q.evidenceGrade ?? 'unknown'),
    missingRequiredCount: missing.length,
    heuristicRule: missing.length === 0,
  });

  return buildResult({
    ruleId: RULE_ID,
    ruleVersion: RULE_VERSION,
    inputs: {
      printer: inputs.printer.type,
      structuralMaterial: inputs.material.structural,
      largestPart_mm: partX && partY && partZ ? [partX.value, partY.value, partZ.value] : null,
      wallThickness_mm: wall?.value ?? null,
    },
    inputProvenance: {
      'printer.envelope': inputs.printer.envelopeX?.provenance ?? 'absent',
      'slate.dimensions': inputs.slate.width?.provenance ?? 'absent',
    },
    assumptions: definition.assumptions,
    procedure: definition.formulas.map(fm => `${fm.id}: ${fm.expression}`),
    trace,
    thresholds: { ...THRESHOLDS },
    checks,
    metrics: {
      failedCheckCount: checks.filter(c => c.status === 'fail').length,
      requiresValidationCount: checks.filter(c => c.status === 'requires_validation').length,
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
