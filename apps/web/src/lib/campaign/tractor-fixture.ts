import type {
  CampaignFixture, Dependency, Evidence, Measurement, Protocol, Requirement, TestRecord,
} from './contracts';

const FIXTURE = { owner: 'FIXTURE' as const, sourceId: 'FIXTURE-TRACTOR-2026-01', fixture: true };
const kup = (sourceId: string) => ({ owner: 'KUP' as const, sourceId, fixture: true });
const lab = (sourceId: string) => ({ owner: 'APORAKSHA_LAB' as const, sourceId, fixture: true });
const logic = (sourceId: string) => ({ owner: 'LOGICHUB' as const, sourceId, fixture: true });

const dependencies: Dependency[] = [
  ['BATTERY', 'Battery', '96 kWh LFP fixture pack', ['usable energy', 'peak discharge', 'continuous discharge', 'temperature stability', 'vibration tolerance', 'ingress protection', 'SOC accuracy', 'charging performance', 'cycle behaviour']],
  ['MOTOR', 'Motor', 'Traction motor subsystem', ['continuous torque', 'peak torque', 'temperature stability', 'derating behaviour']],
  ['INVERTER', 'Inverter', 'Motor inverter and power electronics', ['continuous power', 'transient power', 'fault handling', 'thermal margin']],
  ['THERMAL', 'Thermal', 'Battery, motor and inverter heat rejection', ['steady-state temperature', 'gradient', 'thermal soak recovery', 'derating threshold']],
  ['TRACTION', 'Traction', 'Tyre-ground and driveline tractive performance', ['drawbar force', 'slip', 'slope repeatability', 'rough-terrain stability']],
  ['PTO', 'PTO', 'Power take-off subsystem', ['steady PTO power', 'transient response', 'speed regulation']],
  ['HYDRAULIC', 'Hydraulic', 'Implement hydraulic power subsystem', ['pressure', 'flow', 'temperature', 'continuous load capability']],
  ['CHASSIS', 'Chassis', 'Structure, mounts, connectors and sealing', ['vibration tolerance', 'rough-terrain durability', 'water/mud resistance']],
  ['CHARGING', 'Charging', 'Charge inlet, charger and turnaround workflow', ['charge completion', 'interruption recovery', 'turnaround time']],
].map(([id, name, description, requiredProperties]) => ({
  id: String(id), name: String(name), description: String(description),
  requiredProperties: requiredProperties as string[], riskIds: [], provenance: kup(`KUP-DEP-${id}`),
}));

const protocols: Protocol[] = [
  ['ATL-PROT-ROUGH', 'R03', 'Rough-terrain duty cycle'],
  ['ATL-PROT-SLOPE', 'R02', 'Slope repeatability'],
  ['ATL-PROT-DRAWBAR', 'R04', 'Drawbar load'],
  ['ATL-PROT-PTO', 'R05', 'PTO transient'],
  ['ATL-PROT-THERM', 'R04', 'Thermal soak'],
  ['ATL-PROT-VIB', 'R03', 'Vibration'],
  ['ATL-PROT-WET', 'R02', 'Water / mud exposure'],
  ['ATL-PROT-CHARGE', 'R03', 'Charge cycle'],
  ['ATL-PROT-CONT', 'R02', 'Continuous duty'],
  ['ATL-PROT-HYD', 'R02', 'Hydraulic load'],
  ['ATL-PROT-ENERGY', 'R03', 'Usable energy'],
  ['ATL-PROT-INVERTER', 'R02', 'Inverter thermal load'],
].map(([id, revision, title]) => ({ id, revision, title, owner: 'APORAKSHA_LAB', provenance: lab(id) }));

function test(
  id: string,
  name: string,
  dependencyIds: string[],
  protocolId: string,
  status: TestRecord['status'],
  evidenceIds: string[],
  overrides: Partial<TestRecord> = {},
): TestRecord {
  const protocol = protocols.find((item) => item.id === protocolId)!;
  return {
    id, name, purpose: `Evaluate ${name.toLowerCase()} against the defined agricultural duty fixture criteria.`,
    hypothesis: `${name} remains within the configured requirement envelope for the defined duty.`,
    dependencyIds, protocolId, protocolRevision: protocol.revision, status,
    date: status === 'PLANNED' || status === 'READY' ? undefined : '2026-08-18T09:30:00+05:30',
    operator: 'OP-FIX-07', reviewer: 'REV-FIX-02', configurationRevisionId: 'TESTCFG-R08',
    tractorRevisionId: 'TRACTOR-R07', batteryRevisionId: 'PACK-R04', firmwareRevisionId: 'VEH-FW-R12',
    environment: ['SIMULATED: ambient 32 °C', 'SIMULATED: dry soil / mixed terrain fixture'],
    variables: ['load', 'speed', 'temperature', 'SOC'], controls: ['diesel reference protocol held constant where applicable'],
    equipment: ['SIMULATED DAQ', 'SIMULATED force transducer', 'SIMULATED CAN logger'],
    calibrationState: 'FIXTURE — calibration artifacts linked where required',
    procedure: ['Confirm configuration IDs', 'Confirm calibration state', 'Run protocol phases', 'Capture immutable raw evidence'],
    stopConditions: ['safety interlock', 'critical thermal limit', 'loss of measurement integrity'],
    observation: status === 'FAIL' ? 'SIMULATED OBSERVATION: criterion excursion recorded.' : 'SIMULATED OBSERVATION: fixture record captured.',
    calculation: 'SIMULATED CALCULATION: derived only from fixture measurements; not field evidence.',
    interpretation: status === 'FAIL' ? 'SIMULATED INTERPRETATION: configured criterion not met.' : 'SIMULATED INTERPRETATION: evaluate only within defined duty scope.',
    claimImpact: status === 'FAIL' ? 'Constrains support until a declared condition or verified fix exists.' : 'Contributes only to linked requirement(s).',
    review: 'FIXTURE REVIEW RECORD — not laboratory approval.', requiredEvidenceIds: evidenceIds,
    result: status, provenance: lab(id), ...overrides,
  };
}

const tests: TestRecord[] = [
  test('ROUGH-01', 'Rough-terrain cycle', ['TRACTION', 'CHASSIS', 'BATTERY'], 'ATL-PROT-ROUGH', 'PASS', ['EV-ROUGH-RAW', 'EV-ROUGH-REPORT']),
  test('SLOPE-01', 'Slope test', ['TRACTION', 'MOTOR', 'BATTERY'], 'ATL-PROT-SLOPE', 'INCONCLUSIVE', ['EV-SLOPE-RAW']),
  test('DRAWBAR-01', 'Drawbar load', ['TRACTION', 'MOTOR', 'INVERTER'], 'ATL-PROT-DRAWBAR', 'PASS', ['EV-DRAWBAR-RAW', 'EV-DRAWBAR-CAL']),
  test('PTO-01', 'PTO transient', ['PTO', 'MOTOR', 'INVERTER'], 'ATL-PROT-PTO', 'FAIL', ['EV-PTO-RAW', 'EV-PTO-FAIL']),
  test('THERMAL-01', 'Thermal soak', ['THERMAL', 'BATTERY', 'MOTOR', 'INVERTER'], 'ATL-PROT-THERM', 'PASS', ['EV-THERM-R07', 'EV-THERM-REPORT']),
  test('VIB-01', 'Vibration', ['CHASSIS', 'BATTERY'], 'ATL-PROT-VIB', 'PASS', ['EV-VIB-RAW']),
  test('WET-01', 'Water / mud exposure', ['CHASSIS', 'BATTERY'], 'ATL-PROT-WET', 'PASS', ['EV-WET-REPORT']),
  test('CHARGE-01', 'Charge cycle', ['CHARGING', 'BATTERY'], 'ATL-PROT-CHARGE', 'PASS', ['EV-CHARGE-RAW']),
  test('CONT-01', 'Continuous duty', ['BATTERY', 'MOTOR', 'THERMAL', 'HYDRAULIC'], 'ATL-PROT-CONT', 'READY', []),
  test('HYD-01', 'Hydraulic continuous load', ['HYDRAULIC', 'THERMAL'], 'ATL-PROT-HYD', 'PASS', ['EV-HYD-RAW']),
  test('BAT-ENERGY-01', 'Usable energy', ['BATTERY'], 'ATL-PROT-ENERGY', 'PASS', ['EV-BAT-ENERGY']),
  test('INV-THERM-01', 'Inverter thermal load', ['INVERTER', 'THERMAL'], 'ATL-PROT-INVERTER', 'PASS', ['EV-INV-RAW']),
];

const requirements: Requirement[] = [
  ['REQ-ENERGY', 'BATTERY', 'Usable energy must support the defined five-hour mixed duty.', true, false, ['BAT-ENERGY-01', 'ROUGH-01']],
  ['REQ-TRACTION', 'TRACTION', 'Drawbar and rough-terrain traction must meet the defined duty criteria.', true, false, ['DRAWBAR-01', 'ROUGH-01']],
  ['REQ-SLOPE', 'TRACTION', 'Slope performance must be repeatable within the defined duty envelope.', true, true, ['SLOPE-01']],
  ['REQ-THERMAL', 'THERMAL', 'No invalidating thermal derating may prevent completion of the defined duty.', true, false, ['THERMAL-01', 'INV-THERM-01']],
  ['REQ-PTO', 'PTO', 'PTO transient must meet the configured transient criterion or the supported duty must explicitly exclude the failing transient.', true, true, ['PTO-01']],
  ['REQ-HYD', 'HYDRAULIC', 'Hydraulic subsystem must sustain the defined implement load.', true, false, ['HYD-01']],
  ['REQ-CHASSIS', 'CHASSIS', 'Structure and sealing must survive vibration and water/mud exposure.', true, false, ['VIB-01', 'WET-01']],
  ['REQ-CHARGE', 'CHARGING', 'The configured charge cycle must complete without an unresolved interruption.', true, false, ['CHARGE-01']],
  ['REQ-CONT', 'MOTOR', 'Continuous-duty evidence must cover the required duration before unrestricted support.', true, true, ['CONT-01']],
].map(([id, dependencyId, statement, critical, conditionalAllowed, testIds]) => ({
  id: String(id), dependencyId: String(dependencyId), statement: String(statement), critical: Boolean(critical),
  conditionalAllowed: Boolean(conditionalAllowed), claimScope: 'DEFINED_AG_DUTY', testIds: testIds as string[], provenance: kup(String(id)),
}));

const evidenceRows: Array<[string, Evidence['type'], string, string, string[], string[], Evidence['state']]> = [
  ['EV-ROUGH-RAW', 'SENSOR_LOG', 'Aporaksha-Lab fixture logger', 'ROUGH-01', ['TRACTOR-R07', 'PACK-R04', 'VEH-FW-R12'], ['traction-map', 'battery-pack'], 'REVIEWED'],
  ['EV-ROUGH-REPORT', 'TEST_REPORT', 'Aporaksha-Lab fixture report', 'ROUGH-01', ['TRACTOR-R07', 'TESTCFG-R08'], ['test-configuration'], 'REVIEWED'],
  ['EV-SLOPE-RAW', 'RAW_DATA', 'Aporaksha-Lab fixture logger', 'SLOPE-01', ['TRACTOR-R07', 'PACK-R04'], ['traction-map'], 'PRESENT'],
  ['EV-DRAWBAR-RAW', 'RAW_DATA', 'Aporaksha-Lab fixture DAQ', 'DRAWBAR-01', ['TRACTOR-R07', 'MOTOR-R03', 'INV-R05'], ['motor', 'inverter'], 'REPLICATED'],
  ['EV-DRAWBAR-CAL', 'CALIBRATION', 'Aporaksha-Lab fixture calibration', 'DRAWBAR-01', ['TESTCFG-R08'], ['force-transducer'], 'REVIEWED'],
  ['EV-PTO-RAW', 'SENSOR_LOG', 'Aporaksha-Lab fixture CAN log', 'PTO-01', ['TRACTOR-R07', 'PTO-R02', 'VEH-FW-R12'], ['pto-control', 'vehicle-firmware'], 'REVIEWED'],
  ['EV-PTO-FAIL', 'FAILURE_REPORT', 'Aporaksha-Lab fixture failure report', 'PTO-01', ['TRACTOR-R07', 'PTO-R02'], ['pto-control'], 'REVIEWED'],
  ['EV-THERM-R07', 'SENSOR_LOG', 'Aporaksha-Lab fixture thermal logger', 'THERMAL-01', ['TRACTOR-R07', 'PACK-R04', 'THERMAL-R02'], ['cooling-plate-geometry', 'battery-pack'], 'REPLICATED'],
  ['EV-THERM-REPORT', 'TEST_REPORT', 'Aporaksha-Lab fixture thermal report', 'THERMAL-01', ['TRACTOR-R07', 'THERMAL-R02'], ['cooling-plate-geometry'], 'REVIEWED'],
  ['EV-THERM-R06-STALE', 'SENSOR_LOG', 'Superseded fixture thermal logger', 'THERMAL-01', ['TRACTOR-R06', 'THERMAL-R01'], ['cooling-plate-geometry'], 'STALE'],
  ['EV-VIB-RAW', 'SENSOR_LOG', 'Aporaksha-Lab fixture accelerometer log', 'VIB-01', ['TRACTOR-R07', 'CHASSIS-R05', 'PACK-R04'], ['mounts', 'battery-pack'], 'REVIEWED'],
  ['EV-WET-REPORT', 'TEST_REPORT', 'Aporaksha-Lab fixture wet exposure report', 'WET-01', ['TRACTOR-R07', 'CHASSIS-R05'], ['sealing'], 'REVIEWED'],
  ['EV-CHARGE-RAW', 'SENSOR_LOG', 'Aporaksha-Lab fixture charger log', 'CHARGE-01', ['TRACTOR-R07', 'CHG-R03', 'BMS-FW-R07'], ['charger', 'bms-firmware'], 'REVIEWED'],
  ['EV-HYD-RAW', 'SENSOR_LOG', 'Aporaksha-Lab fixture hydraulic logger', 'HYD-01', ['TRACTOR-R07', 'HYD-R04'], ['hydraulics'], 'REVIEWED'],
  ['EV-BAT-ENERGY', 'TEST_REPORT', 'Aporaksha-Lab fixture capacity report', 'BAT-ENERGY-01', ['TRACTOR-R07', 'PACK-R04', 'BMS-FW-R07'], ['battery-pack', 'bms-firmware'], 'REPLICATED'],
  ['EV-INV-RAW', 'SENSOR_LOG', 'Aporaksha-Lab fixture inverter logger', 'INV-THERM-01', ['TRACTOR-R07', 'INV-R05', 'THERMAL-R02'], ['inverter', 'cooling-plate-geometry'], 'REVIEWED'],
];

const evidence: Evidence[] = evidenceRows.map(([id, type, source, testId, boundRevisionIds, validityKeys, state], index) => ({
  id, type, source, sha256: `${String(index + 1).padStart(2, '0')}${'a'.repeat(62)}`,
  timestamp: `2026-08-${String(10 + (index % 9)).padStart(2, '0')}T10:${String(index).padStart(2, '0')}:00+05:30`,
  testId, revisionId: boundRevisionIds[0], boundRevisionIds, validityKeys, state,
  staleReason: state === 'STALE' ? 'SIMULATED: superseded thermal configuration.' : undefined,
  reviewState: state, artifactPath: `fixture://evidence/${id}`, provenance: lab(id),
}));

const measurementDefs: Array<[string, string, number, string, string]> = [
  ['M-001', 'ROUGH-01', 17.8, 'kWh/h', 'energy_rate'], ['M-002', 'ROUGH-01', 41.2, '°C', 'pack_temp_max'],
  ['M-003', 'ROUGH-01', 68.4, '°C', 'motor_temp_max'], ['M-004', 'ROUGH-01', 23.6, '%', 'soc_loss'],
  ['M-005', 'DRAWBAR-01', 28.2, 'kN', 'tractive_force'], ['M-006', 'DRAWBAR-01', 6.4, 'km/h', 'speed'],
  ['M-007', 'PTO-01', 52.0, 'kW', 'pto_load_peak'], ['M-008', 'PTO-01', 74.3, '°C', 'motor_temp_peak'],
  ['M-009', 'PTO-01', 1.0, 'count', 'derating_events'], ['M-010', 'THERMAL-01', 44.8, '°C', 'pack_temp_max'],
  ['M-011', 'THERMAL-01', 76.1, '°C', 'motor_temp_max'], ['M-012', 'THERMAL-01', 71.0, '°C', 'inverter_temp_max'],
  ['M-013', 'SLOPE-01', 11.4, '%', 'grade'], ['M-014', 'SLOPE-01', 13.2, '%', 'wheel_slip'],
  ['M-015', 'CHARGE-01', 66.4, 'kWh', 'energy_added'], ['M-016', 'CHARGE-01', 0.0, 'count', 'charge_interruptions'],
  ['M-017', 'HYD-01', 178.0, 'bar', 'hydraulic_pressure'], ['M-018', 'HYD-01', 42.0, 'L/min', 'hydraulic_flow'],
  ['M-019', 'BAT-ENERGY-01', 83.1, 'kWh', 'usable_energy'], ['M-020', 'BAT-ENERGY-01', 27.0, '%', 'end_soc'],
  ['M-021', 'VIB-01', 4.6, 'g', 'vibration_peak'], ['M-022', 'WET-01', 0.0, 'count', 'ingress_faults'],
  ['M-023', 'INV-THERM-01', 69.6, '°C', 'inverter_temp_max'], ['M-024', 'ROUGH-01', 1.34, 'ha/h', 'work_rate'],
];

const measurements: Measurement[] = measurementDefs.map(([id, testId, value, unit, metric], index) => ({
  id, testId, timestamp: `2026-08-18T12:${String(10 + index).padStart(2, '0')}:00+05:30`, metric, value, unit,
  phase: ['TRANSPORT', 'PLOUGHING', 'SLOPE', 'PTO', 'ROUGH_TERRAIN'][index % 5], provenance: FIXTURE,
}));

export const tractorFixture: CampaignFixture = {
  label: 'SIMULATED FIXTURE DATA',
  campaign: {
    id: 'electric-tractor-duty-replacement', name: 'Electric Tractor — Defined Agricultural Duty Replacement', state: 'TESTING',
    claimId: 'KUP-CLAIM-TRACTOR-001', testCampaignId: 'ATL-TRACTOR-2026-01', evidencePackageId: 'EVPK-0038',
    currentRevisionId: 'TRACTOR-R07', lastEvidenceUpdate: '2026-08-18T17:42:00+05:30', provenance: kup('KUP-CAMPAIGN-TRACTOR-001'),
  },
  claim: {
    id: 'KUP-CLAIM-TRACTOR-001', text: '96-kWh electric tractor can replace a diesel tractor in a defined agricultural duty.',
    type: 'performance / operational substitution', subject: '96-kWh electric tractor fixture candidate',
    context: 'Defined 5-hour mixed agricultural cycle', comparator: 'diesel reference measured under its own evidence IDs',
    operatingConditions: ['transport', 'implement operation', 'PTO load', 'slope operation', 'rough-terrain travel'],
    successCriteria: ['required work completed', 'critical thermal envelope maintained', 'traction criteria met', 'energy remains sufficient for defined duty'],
    definedDuty: '5-hour mixed agricultural cycle', activities: ['transport', 'implement operation', 'PTO load', 'slope operation', 'rough-terrain travel'],
    whatWouldMakeFalse: ['insufficient continuous-duty runtime', 'thermal derating prevents required work', 'cost/hour exceeds verified comparator criterion', 'repeated slope test fails', 'battery degradation invalidates duty economics'],
    signalSource: 'FIXTURE KUP source signal — no external tractor claim imported', investigationReason: 'Exercise claim → dependency → test → evidence → revision → decision traceability.',
    state: 'CONDITIONALLY_SUPPORTED', provenance: kup('KUP-CLAIM-TRACTOR-001'),
  },
  dependencies, requirements, protocols, tests, measurements, evidence,
  failures: [
    { id: 'FAIL-001', time: '2026-08-18T12:42:23+05:30', testId: 'PTO-01', severity: 'HIGH', componentId: 'MOTOR-R03', configurationRevisionId: 'TESTCFG-R08', description: 'SIMULATED motor derating during PTO transient.', rootCause: 'Fixture hypothesis: transient thermal/power threshold interaction.', status: 'ROOT_CAUSE_FOUND', provenance: lab('FAIL-001') },
    { id: 'FAIL-002', time: '2026-08-17T14:08:10+05:30', testId: 'SLOPE-01', severity: 'MEDIUM', componentId: 'BMS-FW-R07', configurationRevisionId: 'TESTCFG-R08', description: 'SIMULATED BMS warning observed during one slope repeat.', rootCause: 'Not yet isolated in fixture.', status: 'UNDER_INVESTIGATION', provenance: lab('FAIL-002') },
    { id: 'FAIL-003', time: '2026-08-16T16:22:00+05:30', testId: 'CHARGE-01', severity: 'HIGH', componentId: 'CHG-R03', configurationRevisionId: 'TESTCFG-R07', description: 'SIMULATED charge interruption in superseded configuration.', rootCause: 'Fixture connector debounce configuration.', status: 'FIX_VERIFIED', provenance: lab('FAIL-003') },
  ],
  componentRevisions: [
    ['TRACTOR-R06', 'TRACTOR', 'TRACTOR-R06'], ['TRACTOR-R07', 'TRACTOR', 'TRACTOR-R07'], ['TRACTOR-R08', 'TRACTOR', 'TRACTOR-R08'],
    ['PACK-R04', 'BATTERY', 'TRACTOR-R07'], ['BMS-FW-R07', 'BMS', 'TRACTOR-R07'], ['MOTOR-R03', 'MOTOR', 'TRACTOR-R07'],
    ['INV-R05', 'INVERTER', 'TRACTOR-R07'], ['VEH-FW-R12', 'CONTROL SOFTWARE', 'TRACTOR-R07'], ['PTO-R02', 'PTO', 'TRACTOR-R07'],
    ['HYD-R04', 'HYDRAULICS', 'TRACTOR-R07'], ['CHASSIS-R05', 'CHASSIS', 'TRACTOR-R07'], ['CHG-R03', 'CHARGER', 'TRACTOR-R07'],
    ['TESTCFG-R07', 'TEST CONFIGURATION', 'TRACTOR-R06'], ['TESTCFG-R08', 'TEST CONFIGURATION', 'TRACTOR-R07'],
    ['THERMAL-R01', 'THERMAL', 'TRACTOR-R06'], ['THERMAL-R02', 'THERMAL', 'TRACTOR-R07'], ['THERMAL-R03', 'THERMAL', 'TRACTOR-R08'],
  ].map(([id, component, parentMachineRevisionId], index) => ({
    id, component, parentMachineRevisionId, createdAt: `2026-08-${String(1 + index).padStart(2, '0')}T10:00:00+05:30`,
    sourceCommit: `${String(index + 1).padStart(2, '0')}${'b'.repeat(38)}`, state: id === 'TRACTOR-R07' || parentMachineRevisionId === 'TRACTOR-R07' ? 'CURRENT' : 'FIXTURE', provenance: logic(id),
  })),
  changes: [{
    id: 'EC-THERM-008', component: 'BATTERY COOLING PLATE', fromRevisionId: 'THERMAL-R02', toRevisionId: 'THERMAL-R03', machineRevisionId: 'TRACTOR-R08',
    changedAttributes: ['cooling-plate-geometry'], whatChanged: 'Channel geometry modified (SIMULATED FIXTURE).', why: 'Fixture temperature-gradient criterion exceeded in prior investigation.',
    reason: 'Cooling plate geometry changed; thermal evidence bound to R02 requires re-verification.', affectedRequirementIds: ['REQ-THERMAL', 'REQ-CONT'], provenance: logic('EC-THERM-008'),
  }],
  timeline: [
    ['TL-001', '2026-08-01T09:00:00+05:30', 'CLAIM_CREATED', 'Claim created', 'KUP claim registered.', ['KUP-CLAIM-TRACTOR-001']],
    ['TL-002', '2026-08-03T11:00:00+05:30', 'PROGRAM_APPROVED', 'Test program approved', 'Aporaksha-Lab fixture program linked.', ['ATL-TRACTOR-2026-01']],
    ['TL-003', '2026-08-12T12:42:23+05:30', 'FAILURE', 'PTO transient failure', 'Fixture failure FAIL-001 captured.', ['FAIL-001', 'PTO-01']],
    ['TL-004', '2026-08-14T15:10:00+05:30', 'ENGINEERING_CHANGE', 'Cooling investigation opened', 'LogicHub change intent linked.', ['EC-THERM-008']],
    ['TL-005', '2026-08-18T17:42:00+05:30', 'DECISION', 'Current constrained decision', 'Defined duty remains conditional in fixture.', ['KUP-CLAIM-TRACTOR-001']],
  ].map(([id, timestamp, type, title, detail, linkedIds]) => ({ id: String(id), timestamp: String(timestamp), type: String(type), title: String(title), detail: String(detail), linkedIds: linkedIds as string[] })),
  economicAssumptions: [
    { id: 'ECON-ELEC', name: 'Electricity price', unit: '₹/kWh', state: 'MISSING', note: 'No verified input supplied. Dashboard must not infer operating cost.', provenance: FIXTURE },
    { id: 'ECON-DIESEL', name: 'Diesel price', unit: '₹/L', state: 'MISSING', note: 'No verified input supplied. Comparator economics remain unavailable.', provenance: FIXTURE },
    { id: 'ECON-MAINT', name: 'Maintenance cost', unit: '₹/h', state: 'MISSING', note: 'Requires measured or verified source data.', provenance: FIXTURE },
  ],
  comparator: [
    { id: 'CMP-ENERGY', metric: 'energy/fuel cost', unit: '₹/h', state: 'UNAVAILABLE' },
    { id: 'CMP-WORK', metric: 'work rate', electricValue: 1.34, unit: 'ha/h', electricEvidenceId: 'EV-ROUGH-RAW', state: 'FIXTURE' },
    { id: 'CMP-TRACTIVE', metric: 'tractive force', electricValue: 28.2, unit: 'kN', electricEvidenceId: 'EV-DRAWBAR-RAW', state: 'FIXTURE' },
    { id: 'CMP-CONT', metric: 'continuous duty', unit: 'h', state: 'UNAVAILABLE' },
  ],
  dutyCycle: [
    { id: 'DUTY-1', name: 'TRANSPORT', durationMin: 55, energyKwh: 12.2, socLossPct: 13, maxTempC: 43, work: 'SIMULATED transit segment', faults: 0, derating: false },
    { id: 'DUTY-2', name: 'PLOUGHING', durationMin: 85, energyKwh: 28.1, socLossPct: 30, maxTempC: 68, work: 'SIMULATED 1.9 ha', faults: 0, derating: false },
    { id: 'DUTY-3', name: 'SLOPE', durationMin: 35, energyKwh: 9.6, socLossPct: 10, maxTempC: 71, work: 'SIMULATED repeatability incomplete', faults: 1, derating: false },
    { id: 'DUTY-4', name: 'PTO', durationMin: 45, energyKwh: 14.5, socLossPct: 15, maxTempC: 76, work: 'SIMULATED PTO segment', faults: 1, derating: true },
    { id: 'DUTY-5', name: 'IDLE', durationMin: 20, energyKwh: 1.2, socLossPct: 1, maxTempC: 60, work: 'SIMULATED idle', faults: 0, derating: false },
    { id: 'DUTY-6', name: 'ROUGH TERRAIN', durationMin: 45, energyKwh: 13.3, socLossPct: 14, maxTempC: 68, work: 'SIMULATED rough terrain', faults: 0, derating: false },
    { id: 'DUTY-7', name: 'RETURN', durationMin: 15, energyKwh: 4.2, socLossPct: 4, maxTempC: 56, work: 'SIMULATED return', faults: 0, derating: false },
  ],
  timeSeries: Array.from({ length: 31 }, (_, index) => ({
    t: index * 60, soc: Math.max(27, 100 - index * 2.43), packTemp: 31 + Math.sin(index / 5) * 5 + index * 0.35,
    motorTemp: 34 + Math.sin(index / 4) * 8 + index * 1.05, power: 16 + (index % 7) * 5.2,
    tractiveForce: 8 + (index % 6) * 3.8, speed: 4 + (index % 5) * 1.5, ptoLoad: index >= 20 && index <= 24 ? 48 + (index - 20) * 2.5 : 0,
    hydraulicLoad: index >= 7 && index <= 18 ? 55 + (index % 4) * 8 : 10,
  })),
  testEvents: [
    { id: 'EVT-1', t: 1200, label: 'PTO transient begins' }, { id: 'EVT-2', t: 1260, label: 'Motor temperature spike' }, { id: 'EVT-3', t: 1320, label: 'Power derating activated' },
  ],
  decisionScope: 'DEFINED_AG_DUTY', currentRevisionId: 'TRACTOR-R07',
};

export function makeAcceptanceBaseline(): CampaignFixture {
  const copy = structuredClone(tractorFixture);
  copy.tests = copy.tests.map((item) => {
    if (!['SLOPE-01', 'PTO-01', 'CONT-01'].includes(item.id)) return item;
    const evidenceId = `EV-ACCEPT-${item.id}`;
    item.status = 'PASS';
    item.requiredEvidenceIds = [evidenceId];
    item.result = 'PASS';
    copy.evidence.push({
      id: evidenceId, type: 'TEST_REPORT', source: 'SIMULATED acceptance-scenario evidence', sha256: `${item.id.length}${'c'.repeat(63)}`.slice(0, 64),
      timestamp: '2026-08-19T10:00:00+05:30', testId: item.id, revisionId: 'TRACTOR-R07',
      boundRevisionIds: item.id === 'CONT-01' ? ['TRACTOR-R07', 'THERMAL-R02'] : ['TRACTOR-R07'],
      validityKeys: item.id === 'CONT-01' ? ['cooling-plate-geometry'] : ['test-configuration'], state: 'REVIEWED', reviewState: 'REVIEWED',
      artifactPath: `fixture://evidence/${evidenceId}`, provenance: lab(evidenceId),
    });
    return item;
  });
  copy.failures = copy.failures.map((item) => ({ ...item, status: 'CLOSED' }));
  return copy;
}
