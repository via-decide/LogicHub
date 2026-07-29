import { describe, it, expect } from 'vitest';
import { diagnoseFault } from '../src/diagnostics/fault-tree.js';
import { FAULT_CODES, SELF_TESTS, getSelfTest, requireSelfTest } from '../src/diagnostics/self-tests.js';
import { DiagnosisSchema, SelfTestSchema } from '../src/schemas/diagnostics.schema.js';

describe('Gate 5 — self-test catalogue', () => {
  it('validates every self-test against the schema', () => {
    for (const test of SELF_TESTS) {
      expect(SelfTestSchema.safeParse(test).success, test.id).toBe(true);
    }
  });

  it('points every fault code at a self-test that exists', () => {
    for (const fault of FAULT_CODES) {
      expect(getSelfTest(fault.selfTestId), fault.code).toBeDefined();
    }
  });

  it('uses unique step ids across the catalogue', () => {
    const stepIds = SELF_TESTS.flatMap(t => t.steps.map(s => s.id));
    expect(new Set(stepIds).size).toBe(stepIds.length);
  });

  it('cautions before commanding motion', () => {
    const motorTest = requireSelfTest('selftest.motor');
    const cautions = motorTest.steps.flatMap(s => s.cautions).join(' ');
    expect(cautions).toMatch(/clear/i);
  });

  it('throws for an unknown self-test', () => {
    expect(() => requireSelfTest('nope')).toThrow(/Unknown self-test/);
  });
});

describe('Gate 5 — fault diagnosis', () => {
  it('works the documented motor flow down to ranked causes', () => {
    // Voltage detected, current absent — the circuit is open past the driver.
    const diagnosis = diagnoseFault('F-MOT-001', [
      { stepId: 'motor.supply-voltage', state: 'PRESENT', value: 3.6 },
      { stepId: 'motor.draw-current', state: 'ABSENT' },
      { stepId: 'motor.shaft-motion', state: 'ABSENT' },
    ]);

    expect(DiagnosisSchema.safeParse(diagnosis).success).toBe(true);
    const causes = diagnosis.possibleCauses.map(c => c.id);
    expect(causes).toContain('motor.disconnected');
    expect(causes).toContain('driver.output-failed');
    expect(causes).toContain('motor.damaged-wire');
  });

  it('never narrows a fault to a single asserted cause', () => {
    const diagnosis = diagnoseFault('F-MOT-001', [
      { stepId: 'motor.supply-voltage', state: 'PRESENT' },
      { stepId: 'motor.draw-current', state: 'ABSENT' },
      { stepId: 'motor.shaft-motion', state: 'ABSENT' },
    ]);
    expect(diagnosis.possibleCauses.length).toBeGreaterThan(1);
  });

  it('gives every cause a check that would separate it from the others', () => {
    const diagnosis = diagnoseFault('F-MOT-001', [
      { stepId: 'motor.supply-voltage', state: 'PRESENT' },
      { stepId: 'motor.draw-current', state: 'ABSENT' },
      { stepId: 'motor.shaft-motion', state: 'ABSENT' },
    ]);
    for (const cause of diagnosis.possibleCauses) {
      expect(cause.nextCheck.length).toBeGreaterThan(0);
    }
  });

  it('reaches a different branch when no voltage is present', () => {
    const diagnosis = diagnoseFault('F-MOT-001', [
      { stepId: 'motor.supply-voltage', state: 'ABSENT' },
      { stepId: 'motor.draw-current', state: 'ABSENT' },
      { stepId: 'motor.shaft-motion', state: 'ABSENT' },
    ]);
    expect(diagnosis.possibleCauses.map(c => c.id)).toContain('driver.not-enabled');
    expect(diagnosis.possibleCauses.map(c => c.id)).not.toContain('motor.disconnected');
  });

  it('points at the mechanics when current flows but nothing turns', () => {
    const diagnosis = diagnoseFault('F-MOT-001', [
      { stepId: 'motor.supply-voltage', state: 'PRESENT' },
      { stepId: 'motor.draw-current', state: 'PRESENT' },
      { stepId: 'motor.shaft-motion', state: 'ABSENT' },
    ]);
    expect(diagnosis.possibleCauses.map(c => c.id)).toContain('gearbox.jammed');
  });

  it('marks a diagnosis incomplete when a step was not observed', () => {
    const diagnosis = diagnoseFault('F-MOT-001', [
      { stepId: 'motor.supply-voltage', state: 'PRESENT' },
      { stepId: 'motor.draw-current', state: 'ABSENT' },
    ]);

    expect(diagnosis.incomplete).toBe(true);
    expect(diagnosis.unobservedStepIds).toEqual(['motor.shaft-motion']);
    expect(diagnosis.summary).toMatch(/not conclusive/);
  });

  it('treats an unknown observation as unobserved, never as a negative', () => {
    const withUnknown = diagnoseFault('F-MOT-001', [
      { stepId: 'motor.supply-voltage', state: 'PRESENT' },
      { stepId: 'motor.draw-current', state: 'UNKNOWN' },
      { stepId: 'motor.shaft-motion', state: 'ABSENT' },
    ]);

    expect(withUnknown.incomplete).toBe(true);
    expect(withUnknown.unobservedStepIds).toContain('motor.draw-current');
    // An unknown current must not be read as an absent current, so the
    // open-circuit branch must not fire.
    expect(withUnknown.possibleCauses.map(c => c.id)).not.toContain('motor.disconnected');
  });

  it('marks a fully observed diagnosis complete', () => {
    const diagnosis = diagnoseFault('F-MOT-001', [
      { stepId: 'motor.supply-voltage', state: 'PRESENT' },
      { stepId: 'motor.draw-current', state: 'ABSENT' },
      { stepId: 'motor.shaft-motion', state: 'ABSENT' },
    ]);
    expect(diagnosis.incomplete).toBe(false);
    expect(diagnosis.unobservedStepIds).toEqual([]);
    expect(diagnosis.summary).toMatch(/complete test/);
  });

  it('says so when nothing matches rather than guessing', () => {
    const diagnosis = diagnoseFault('F-MOT-001', []);
    expect(diagnosis.possibleCauses.map(c => c.id)).toEqual(['undetermined']);
    expect(diagnosis.summary).toMatch(/no known fault pattern/);
    expect(diagnosis.incomplete).toBe(true);
  });

  it('diagnoses a collapsing pack', () => {
    const diagnosis = diagnoseFault('F-BAT-001', [
      { stepId: 'battery.terminal-voltage', state: 'PRESENT', value: 4.8 },
      { stepId: 'battery.loaded-voltage', state: 'ABSENT' },
    ]);
    expect(diagnosis.possibleCauses.map(c => c.id)).toContain('pack.high-internal-resistance');
    expect(diagnosis.incomplete).toBe(false);
  });

  it('diagnoses a controller that is powered but silent', () => {
    const diagnosis = diagnoseFault('F-CTL-001', [
      { stepId: 'controller.supply-voltage', state: 'PRESENT' },
      { stepId: 'controller.heartbeat', state: 'ABSENT' },
    ]);
    expect(diagnosis.possibleCauses.map(c => c.id)).toContain('firmware.not-running');
  });

  it('diagnoses a sensor wired to the wrong pin', () => {
    const diagnosis = diagnoseFault('F-SEN-001', [
      { stepId: 'sensor.supply-voltage', state: 'PRESENT' },
      { stepId: 'sensor.reading', state: 'ABSENT' },
    ]);
    expect(diagnosis.possibleCauses.map(c => c.id)).toContain('sensor.pin-mismatch');
  });

  it('diagnoses a link that will not connect', () => {
    const diagnosis = diagnoseFault('F-LNK-001', [
      { stepId: 'link.response', state: 'ABSENT' },
    ]);
    expect(diagnosis.possibleCauses.map(c => c.id)).toContain('link.not-advertising');
  });

  it('returns observations in a stable order', () => {
    const diagnosis = diagnoseFault('F-MOT-001', [
      { stepId: 'motor.shaft-motion', state: 'ABSENT' },
      { stepId: 'motor.supply-voltage', state: 'PRESENT' },
      { stepId: 'motor.draw-current', state: 'ABSENT' },
    ]);
    expect(diagnosis.observations.map(o => o.stepId))
      .toEqual(['motor.draw-current', 'motor.shaft-motion', 'motor.supply-voltage']);
  });

  it('produces the same diagnosis for the same evidence every time', () => {
    const observations = [
      { stepId: 'motor.supply-voltage', state: 'PRESENT' as const },
      { stepId: 'motor.draw-current', state: 'ABSENT' as const },
      { stepId: 'motor.shaft-motion', state: 'ABSENT' as const },
    ];
    const baseline = JSON.stringify(diagnoseFault('F-MOT-001', observations));
    for (let i = 0; i < 5; i += 1) {
      expect(JSON.stringify(diagnoseFault('F-MOT-001', observations))).toBe(baseline);
    }
  });

  it('throws for an unknown fault code', () => {
    expect(() => diagnoseFault('F-NOPE-999', [])).toThrow(/Unknown fault code/);
  });
});
