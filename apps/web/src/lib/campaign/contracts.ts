export type ProvenanceKind = 'KUP' | 'APORAKSHA_LAB' | 'LOGICHUB' | 'USER_INPUT' | 'FIXTURE';
export type ClaimState = 'UNTESTED' | 'TESTING' | 'SUPPORTED' | 'CONDITIONALLY_SUPPORTED' | 'FAILED' | 'INCONCLUSIVE' | 'STALE' | 'REVIEW_REQUIRED';
export type TestState = 'NOT_PLANNED' | 'PLANNED' | 'READY' | 'RUNNING' | 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'BLOCKED' | 'REPEAT_REQUIRED' | 'STALE' | 'REVIEW_REQUIRED';
export type EvidenceState = 'PRESENT' | 'REVIEWED' | 'REPLICATED' | 'EXTERNALLY_VERIFIED' | 'STALE' | 'INVALIDATED';
export type FailureState = 'OPEN' | 'UNDER_INVESTIGATION' | 'ROOT_CAUSE_FOUND' | 'CONTAINED' | 'FIX_PROPOSED' | 'FIX_VERIFIED' | 'CLOSED';
export type DecisionState = 'SUPPORTED' | 'CONDITIONALLY_SUPPORTED' | 'FAILED' | 'INCONCLUSIVE';
export type EvidenceType = 'RAW_DATA' | 'PHOTO' | 'VIDEO' | 'SENSOR_LOG' | 'CALIBRATION' | 'TEST_REPORT' | 'SIMULATION' | 'FAILURE_REPORT' | 'EXTERNAL_LAB_REPORT' | 'ENGINEERING_REVIEW';

export interface Provenance {
  owner: ProvenanceKind;
  sourceId: string;
  sourceUri?: string;
  fixture: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  state: ClaimState;
  claimId: string;
  testCampaignId: string;
  evidencePackageId: string;
  currentRevisionId: string;
  lastEvidenceUpdate: string;
  provenance: Provenance;
}

export interface Claim {
  id: string;
  text: string;
  type: string;
  subject: string;
  context: string;
  comparator: string;
  operatingConditions: string[];
  successCriteria: string[];
  definedDuty: string;
  activities: string[];
  whatWouldMakeFalse: string[];
  signalSource: string;
  investigationReason: string;
  state: ClaimState;
  provenance: Provenance;
}

export interface Dependency {
  id: string;
  name: string;
  description: string;
  requiredProperties: string[];
  riskIds: string[];
  provenance: Provenance;
}

export interface Requirement {
  id: string;
  dependencyId: string;
  statement: string;
  critical: boolean;
  conditionalAllowed: boolean;
  claimScope: string;
  testIds: string[];
  provenance: Provenance;
}

export interface Protocol {
  id: string;
  revision: string;
  title: string;
  owner: 'APORAKSHA_LAB';
  provenance: Provenance;
}

export interface TestRecord {
  id: string;
  name: string;
  purpose: string;
  hypothesis: string;
  dependencyIds: string[];
  protocolId: string;
  protocolRevision: string;
  status: TestState;
  date?: string;
  operator?: string;
  reviewer?: string;
  configurationRevisionId: string;
  tractorRevisionId: string;
  batteryRevisionId: string;
  firmwareRevisionId: string;
  environment: string[];
  variables: string[];
  controls: string[];
  equipment: string[];
  calibrationState: string;
  procedure: string[];
  stopConditions: string[];
  observation: string;
  calculation: string;
  interpretation: string;
  claimImpact: string;
  review: string;
  requiredEvidenceIds: string[];
  result: string;
  provenance: Provenance;
}

export interface Measurement {
  id: string;
  testId: string;
  timestamp: string;
  metric: string;
  value: number;
  unit: string;
  phase?: string;
  provenance: Provenance;
}

export interface TimeSeriesPoint {
  t: number;
  soc: number;
  packTemp: number;
  motorTemp: number;
  power: number;
  tractiveForce: number;
  speed: number;
  ptoLoad: number;
  hydraulicLoad: number;
}

export interface TestEvent {
  id: string;
  t: number;
  label: string;
}

export interface Evidence {
  id: string;
  type: EvidenceType;
  source: string;
  sha256: string;
  timestamp: string;
  testId: string;
  revisionId: string;
  boundRevisionIds: string[];
  validityKeys: string[];
  state: EvidenceState;
  staleReason?: string;
  reviewState: string;
  artifactPath: string;
  provenance: Provenance;
}

export interface Failure {
  id: string;
  time: string;
  testId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  componentId: string;
  configurationRevisionId: string;
  description: string;
  rootCause: string;
  status: FailureState;
  provenance: Provenance;
}

export interface ComponentRevision {
  id: string;
  component: string;
  parentMachineRevisionId: string;
  createdAt: string;
  sourceCommit: string;
  state: 'CURRENT' | 'SUPERSEDED' | 'FIXTURE';
  provenance: Provenance;
}

export interface EngineeringChange {
  id: string;
  component: string;
  fromRevisionId: string;
  toRevisionId: string;
  machineRevisionId: string;
  changedAttributes: string[];
  whatChanged: string;
  why: string;
  reason: string;
  affectedRequirementIds: string[];
  provenance: Provenance;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  detail: string;
  linkedIds: string[];
}

export interface EconomicAssumption {
  id: string;
  name: string;
  value?: number;
  unit: string;
  state: 'MEASURED' | 'VERIFIED_EXTERNAL' | 'USER_INPUT' | 'ASSUMPTION' | 'MISSING';
  note: string;
  provenance: Provenance;
}

export interface ComparatorMetric {
  id: string;
  metric: string;
  electricValue?: number;
  dieselValue?: number;
  unit: string;
  electricEvidenceId?: string;
  dieselEvidenceId?: string;
  state: 'MEASURED' | 'UNAVAILABLE' | 'FIXTURE';
}

export interface DutyPhase {
  id: string;
  name: string;
  durationMin?: number;
  energyKwh?: number;
  socLossPct?: number;
  maxTempC?: number;
  work?: string;
  faults: number;
  derating: boolean;
}

export interface CampaignFixture {
  label: 'SIMULATED FIXTURE DATA';
  campaign: Campaign;
  claim: Claim;
  dependencies: Dependency[];
  requirements: Requirement[];
  protocols: Protocol[];
  tests: TestRecord[];
  measurements: Measurement[];
  timeSeries: TimeSeriesPoint[];
  testEvents: TestEvent[];
  evidence: Evidence[];
  failures: Failure[];
  componentRevisions: ComponentRevision[];
  changes: EngineeringChange[];
  timeline: TimelineEvent[];
  economicAssumptions: EconomicAssumption[];
  comparator: ComparatorMetric[];
  dutyCycle: DutyPhase[];
  decisionScope: string;
  currentRevisionId: string;
}
