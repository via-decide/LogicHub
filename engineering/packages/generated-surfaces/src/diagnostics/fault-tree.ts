import type {
  Diagnosis,
  Observation,
  ObservationState,
  PossibleCause,
} from '../schemas/diagnostics.schema.js';
import { getFaultCode, requireSelfTest } from './self-tests.js';

interface DiagnosticRule {
  /** Every listed step must carry exactly this state for the rule to apply. */
  when: Record<string, ObservationState>;
  causes: readonly PossibleCause[];
}

/**
 * Fault trees, most specific rule first. Each rule yields a ranked list of
 * possible causes — never a single asserted cause, because the observations
 * available here cannot distinguish between them on their own.
 */
const RULES: Record<string, readonly DiagnosticRule[]> = {
  'F-MOT-001': [
    {
      // The classic case: the drive stage is delivering voltage but nothing
      // is drawing it, so the circuit is open somewhere past the driver.
      when: { 'motor.supply-voltage': 'PRESENT', 'motor.draw-current': 'ABSENT' },
      causes: [
        {
          id: 'motor.disconnected',
          description: 'The motor is disconnected at one of its terminals.',
          likelihood: 'likely',
          nextCheck: 'Check continuity from the driver output to each motor terminal.',
        },
        {
          id: 'motor.damaged-wire',
          description: 'A motor lead is broken inside its insulation.',
          likelihood: 'possible',
          nextCheck: 'Flex each lead while watching continuity for an intermittent break.',
        },
        {
          id: 'driver.output-failed',
          description: 'The driver channel has failed open.',
          likelihood: 'possible',
          nextCheck: 'Swap the motor onto the other driver channel and repeat the test.',
        },
      ],
    },
    {
      when: { 'motor.supply-voltage': 'ABSENT' },
      causes: [
        {
          id: 'driver.not-enabled',
          description: 'The driver is not enabled, so no voltage reaches the motor.',
          likelihood: 'likely',
          nextCheck: 'Confirm the driver standby or enable line is asserted by firmware.',
        },
        {
          id: 'supply.not-reaching-driver',
          description: 'The motor supply is not reaching the driver.',
          likelihood: 'likely',
          nextCheck: 'Measure the voltage at the driver motor supply pin.',
        },
        {
          id: 'pack.depleted',
          description: 'The pack is flat or disconnected.',
          likelihood: 'possible',
          nextCheck: 'Measure the pack voltage at its terminals.',
        },
      ],
    },
    {
      when: {
        'motor.supply-voltage': 'PRESENT',
        'motor.draw-current': 'PRESENT',
        'motor.shaft-motion': 'ABSENT',
      },
      causes: [
        {
          id: 'gearbox.jammed',
          description: 'The gearbox or wheel is mechanically jammed.',
          likelihood: 'likely',
          nextCheck: 'Disconnect power and turn the wheel by hand, feeling for binding.',
        },
        {
          id: 'motor.stalled-load',
          description: 'The load exceeds what the motor can start against.',
          likelihood: 'possible',
          nextCheck: 'Lift the chassis so the wheels run free and repeat the test.',
        },
      ],
    },
  ],

  'F-MOT-002': [
    {
      when: { 'motor.shaft-motion': 'PRESENT' },
      causes: [
        {
          id: 'coupling.slipping',
          description: 'The wheel is slipping on the output shaft.',
          likelihood: 'likely',
          nextCheck: 'Mark the shaft and wheel, run the motor, and see whether the marks part.',
        },
        {
          id: 'gearbox.stripped',
          description: 'A gear inside the gearbox is stripped.',
          likelihood: 'possible',
          nextCheck: 'Listen for the motor spinning freely at high pitch under load.',
        },
      ],
    },
  ],

  'F-BAT-001': [
    {
      when: { 'battery.terminal-voltage': 'PRESENT', 'battery.loaded-voltage': 'ABSENT' },
      causes: [
        {
          id: 'pack.high-internal-resistance',
          description: 'The pack collapses under load, which points to worn or poor cells.',
          likelihood: 'likely',
          nextCheck: 'Measure the loaded voltage again with a known-good set of cells.',
        },
        {
          id: 'contacts.corroded',
          description: 'Holder contacts are corroded and drop voltage under current.',
          likelihood: 'possible',
          nextCheck: 'Inspect and clean the holder contacts, then repeat the test.',
        },
      ],
    },
  ],

  'F-CTL-001': [
    {
      when: { 'controller.supply-voltage': 'PRESENT', 'controller.heartbeat': 'ABSENT' },
      causes: [
        {
          id: 'firmware.not-running',
          description: 'The controller is powered but no firmware is running.',
          likelihood: 'likely',
          nextCheck: 'Reflash the firmware and watch for the boot message.',
        },
        {
          id: 'controller.damaged',
          description: 'The controller has been damaged, possibly by over-voltage.',
          likelihood: 'possible',
          nextCheck: 'Substitute a known-good controller board and repeat the test.',
        },
      ],
    },
    {
      when: { 'controller.supply-voltage': 'ABSENT' },
      causes: [
        {
          id: 'supply.not-reaching-controller',
          description: 'No supply is reaching the controller.',
          likelihood: 'likely',
          nextCheck: 'Trace the supply from the pack to the controller input.',
        },
      ],
    },
  ],

  'F-SEN-001': [
    {
      when: { 'sensor.supply-voltage': 'PRESENT', 'sensor.reading': 'ABSENT' },
      causes: [
        {
          id: 'sensor.wiring',
          description: 'A signal line between sensor and controller is not connected.',
          likelihood: 'likely',
          nextCheck: 'Check continuity on each signal line to its assigned pin.',
        },
        {
          id: 'sensor.pin-mismatch',
          description: 'Firmware is reading a different pin from the one wired.',
          likelihood: 'likely',
          nextCheck: 'Compare the pin map in the engineering surface against the wiring.',
        },
        {
          id: 'sensor.failed',
          description: 'The sensor itself has failed.',
          likelihood: 'possible',
          nextCheck: 'Substitute a known-good sensor and repeat the test.',
        },
      ],
    },
  ],

  'F-LNK-001': [
    {
      when: { 'link.response': 'ABSENT' },
      causes: [
        {
          id: 'link.not-advertising',
          description: 'The device is not advertising, so no client can find it.',
          likelihood: 'likely',
          nextCheck: 'Confirm firmware starts the radio and check for it from a second client.',
        },
        {
          id: 'link.already-paired',
          description: 'The device is already connected to another client.',
          likelihood: 'possible',
          nextCheck: 'Disconnect any other client and retry.',
        },
        {
          id: 'link.out-of-range',
          description: 'The client is beyond the usable range.',
          likelihood: 'possible',
          nextCheck: 'Retry within a metre of the device.',
        },
      ],
    },
  ],
};

/**
 * Work a fault down to a ranked set of possible causes.
 *
 * The result is deliberately plural. A diagnosis built on an incomplete test
 * says so: any step left unobserved, or observed as UNKNOWN, marks the whole
 * diagnosis incomplete rather than being quietly read as a negative result.
 */
export function diagnoseFault(faultCode: string, observations: readonly Observation[]): Diagnosis {
  const fault = getFaultCode(faultCode);
  if (!fault) throw new Error(`Unknown fault code: ${faultCode}`);

  const test = requireSelfTest(fault.selfTestId);
  const byStep = new Map(observations.map(o => [o.stepId, o]));

  const unobservedStepIds = test.steps
    .filter(step => {
      const observation = byStep.get(step.id);
      return observation === undefined || observation.state === 'UNKNOWN';
    })
    .map(step => step.id)
    .sort();

  const incomplete = unobservedStepIds.length > 0;

  const matched = (RULES[faultCode] ?? []).find(rule =>
    Object.entries(rule.when).every(([stepId, state]) => byStep.get(stepId)?.state === state));

  const possibleCauses = matched
    ? [...matched.causes]
    : [{
      id: 'undetermined',
      description:
        'The observations recorded so far do not narrow this fault to a known pattern.',
      likelihood: 'possible' as const,
      nextCheck: `Complete every step of ${test.name} and record each result.`,
    }];

  return {
    faultCode,
    // Stable order so the same evidence always reads back the same way.
    observations: [...observations].sort((a, b) => (a.stepId < b.stepId ? -1 : 1)),
    possibleCauses,
    incomplete,
    unobservedStepIds,
    summary: buildSummary(fault.title, matched !== undefined, incomplete, unobservedStepIds.length),
  };
}

function buildSummary(
  title: string,
  matchedPattern: boolean,
  incomplete: boolean,
  unobservedCount: number,
): string {
  if (!matchedPattern) {
    return `${title}: no known fault pattern matches the observations recorded so far.`;
  }
  if (incomplete) {
    return (
      `${title}: causes ranked from a partial test. ${unobservedCount} step(s) were not `
      + 'observed, so this is not conclusive.'
    );
  }
  return `${title}: causes ranked from a complete test.`;
}
