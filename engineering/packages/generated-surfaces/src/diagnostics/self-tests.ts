import type { FaultCode, SelfTest } from '../schemas/diagnostics.schema.js';

/**
 * Self-tests a service technician can run, keyed to the node type they apply
 * to. Only tests whose node type is present in the graph are offered.
 */
export const SELF_TESTS: readonly SelfTest[] = [
  {
    id: 'selftest.motor',
    name: 'Motor drive test',
    appliesToNodeType: 'motor',
    steps: [
      {
        id: 'motor.supply-voltage',
        instruction: 'Measure the voltage at the motor terminals while commanding it to run.',
        measures: 'voltage',
        cautions: ['Raise the wheels clear of the surface before commanding motion.'],
      },
      {
        id: 'motor.draw-current',
        instruction: 'Measure the current drawn while commanding the motor to run.',
        measures: 'current',
        cautions: [],
      },
      {
        id: 'motor.shaft-motion',
        instruction: 'Observe whether the output shaft turns.',
        measures: 'motion',
        cautions: ['Keep fingers clear of the shaft and wheel.'],
      },
    ],
  },
  {
    id: 'selftest.battery',
    name: 'Pack test',
    appliesToNodeType: 'battery',
    steps: [
      {
        id: 'battery.terminal-voltage',
        instruction: 'Measure the pack voltage at rest.',
        measures: 'voltage',
        cautions: [],
      },
      {
        id: 'battery.loaded-voltage',
        instruction: 'Measure the pack voltage under load.',
        measures: 'voltage',
        cautions: ['Do not short the pack terminals while probing.'],
      },
    ],
  },
  {
    id: 'selftest.controller',
    name: 'Controller test',
    appliesToNodeType: 'controller',
    steps: [
      {
        id: 'controller.supply-voltage',
        instruction: 'Measure the voltage at the controller supply input.',
        measures: 'voltage',
        cautions: [],
      },
      {
        id: 'controller.heartbeat',
        instruction: 'Confirm the controller responds over its debug link.',
        measures: 'response',
        cautions: [],
      },
    ],
  },
  {
    id: 'selftest.sensor',
    name: 'Sensor test',
    appliesToNodeType: 'sensor',
    steps: [
      {
        id: 'sensor.supply-voltage',
        instruction: 'Measure the voltage at the sensor supply pin.',
        measures: 'voltage',
        cautions: [],
      },
      {
        id: 'sensor.reading',
        instruction: 'Present a known stimulus and record the reported reading.',
        measures: 'reading',
        cautions: [],
      },
    ],
  },
  {
    id: 'selftest.connectivity',
    name: 'Link test',
    appliesToNodeType: 'connectivity',
    steps: [
      {
        id: 'link.response',
        instruction: 'Attempt to pair from a client and observe whether the link establishes.',
        measures: 'response',
        cautions: [],
      },
    ],
  },
];

/**
 * Fault codes, each pointing at the self-test that investigates it. A code
 * names a symptom, not a diagnosis.
 */
export const FAULT_CODES: readonly FaultCode[] = [
  {
    code: 'F-MOT-001',
    title: 'Motor does not start',
    appliesToNodeType: 'motor',
    selfTestId: 'selftest.motor',
  },
  {
    code: 'F-MOT-002',
    title: 'Motor runs but the vehicle does not move',
    appliesToNodeType: 'motor',
    selfTestId: 'selftest.motor',
  },
  {
    code: 'F-BAT-001',
    title: 'Runtime far shorter than expected',
    appliesToNodeType: 'battery',
    selfTestId: 'selftest.battery',
  },
  {
    code: 'F-CTL-001',
    title: 'Controller does not respond',
    appliesToNodeType: 'controller',
    selfTestId: 'selftest.controller',
  },
  {
    code: 'F-SEN-001',
    title: 'Sensor reports no reading',
    appliesToNodeType: 'sensor',
    selfTestId: 'selftest.sensor',
  },
  {
    code: 'F-LNK-001',
    title: 'Operator app cannot connect',
    appliesToNodeType: 'connectivity',
    selfTestId: 'selftest.connectivity',
  },
];

const TESTS_BY_ID = new Map(SELF_TESTS.map(t => [t.id, t]));

export function getSelfTest(id: string): SelfTest | undefined {
  return TESTS_BY_ID.get(id);
}

export function requireSelfTest(id: string): SelfTest {
  const found = TESTS_BY_ID.get(id);
  if (!found) throw new Error(`Unknown self-test: ${id}`);
  return found;
}

export function getFaultCode(code: string): FaultCode | undefined {
  return FAULT_CODES.find(f => f.code === code);
}
