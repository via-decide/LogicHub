import { describe, it, expect } from 'vitest';
import { requireKit } from '@logichub-engineering/kit-matching';
import { encodeKitQr, resolveKitFromQr } from '../src/identity/kit-qr.js';
import { buildPrePowerChecklist, evaluateChecklist } from '../src/checklist/pre-power.js';
import { createPrototypeRevision } from '../src/revision/prototype-revision.js';
import { REQUIRED_QUANTITIES } from '../src/measurement/comparison.js';
import {
  PrototypeRevisionSchema,
  type ChecklistResponse,
  type FlashRecord,
} from '../src/schemas/loop.schema.js';
import { FIXED_TIME, IDENTITY, evidence, measurement } from './helpers.js';

const FLASH: FlashRecord = {
  firmwareRevision: 'fw-1.0.0',
  firmwareSha256: 'b'.repeat(64),
  target: 'esp32',
  flashedAt: FIXED_TIME,
  flashedBy: 'test-technician',
  verifiedResponding: true,
};

function clearedChecklist() {
  const items = buildPrePowerChecklist(requireKit('motion-starter'));
  const responses: Record<string, ChecklistResponse> = Object.fromEntries(
    items.map(i => [i.id, 'PASS' as ChecklistResponse]),
  );
  return evaluateChecklist(items, responses);
}

function loopGraph() {
  return resolveKitFromQr(encodeKitQr(IDENTITY), { now: FIXED_TIME }).graph;
}

function revisionWith(measurements: Parameters<typeof createPrototypeRevision>[0]['measurements']) {
  return createPrototypeRevision({
    identity: IDENTITY,
    graph: loopGraph(),
    checklist: clearedChecklist(),
    flash: FLASH,
    measurements,
    evidence: measurements.map(m => evidence(m.evidenceRef)),
    savedAt: FIXED_TIME,
  });
}

describe('Gate 7 — prototype revision', () => {
  it('saves a schema-valid revision for the full documented flow', () => {
    const revision = revisionWith(REQUIRED_QUANTITIES.map(q => measurement(q, 1)));
    expect(PrototypeRevisionSchema.safeParse(revision).success).toBe(true);
  });

  it('records the scanned unit, not just the kit design', () => {
    const revision = revisionWith([measurement('battery.voltage', 4.7)]);
    expect(revision.identity.unitSerial).toBe('MS-000123');
    expect(revision.identity.hardwareRevision).toBe('hw-a');
  });

  it('rejects measurements from another physical unit', () => {
    expect(() => revisionWith([
      measurement('battery.voltage', 4.7, { unitSerial: 'MS-999999' }),
    ])).toThrow(/not MS-000123/);
  });

  it('rejects measurements from another hardware revision', () => {
    expect(() => revisionWith([
      measurement('battery.voltage', 4.7, { hardwareRevision: 'hw-b' }),
    ])).toThrow(/hw-b.*not MS-000123.*hw-a/);
  });

  it('binds the revision to the graph it was taken against', () => {
    const revision = revisionWith([measurement('battery.voltage', 4.7)]);
    expect(revision.productGraphHash).toMatch(/^[a-f0-9]{64}$/);
    expect(revision.sourceGraphId).toBe(loopGraph().id);
  });

  it('records the flash as an attested event, not something it performed', () => {
    const revision = revisionWith([measurement('battery.voltage', 4.7)]);
    expect(revision.flash?.flashedBy).toBe('test-technician');
    expect(revision.flash?.firmwareSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('accepts a revision where nothing was flashed', () => {
    const revision = createPrototypeRevision({
      identity: IDENTITY,
      graph: loopGraph(),
      checklist: clearedChecklist(),
      flash: null,
      measurements: [],
      evidence: [],
      savedAt: FIXED_TIME,
    });
    expect(revision.flash).toBeNull();
  });

  it('stands as UNVALIDATED when nothing was measured', () => {
    const revision = revisionWith([]);
    expect(revision.standing).toBe('UNVALIDATED');
  });

  it('stands as PARTIAL when only some quantities were measured', () => {
    const revision = revisionWith([measurement('battery.voltage', 4.7)]);
    expect(revision.standing).toBe('PARTIAL');
    expect(revision.comparison.complete).toBe(false);
  });

  it('stands as CHARACTERISED only when every quantity was measured', () => {
    const revision = revisionWith(REQUIRED_QUANTITIES.map(q => measurement(q, 1)));
    expect(revision.standing).toBe('CHARACTERISED');
    expect(revision.comparison.complete).toBe(true);
  });

  it('has no state that could claim the design is verified or certified', () => {
    // Measuring one unit characterises that unit. It does not validate the
    // design, and the schema offers no way to say otherwise.
    const revision = revisionWith(REQUIRED_QUANTITIES.map(q => measurement(q, 1)));
    const states = PrototypeRevisionSchema.shape.standing.options;

    expect(states).toEqual(['UNVALIDATED', 'PARTIAL', 'CHARACTERISED']);
    expect(states).not.toContain('VERIFIED');
    expect(states).not.toContain('CERTIFIED');
    expect(JSON.stringify(revision)).not.toMatch(/certified|production-ready/i);
  });

  it('preserves the estimates alongside the measurements', () => {
    const revision = revisionWith([measurement('battery.voltage', 4.32)]);
    const entry = revision.comparison.comparisons.find(c => c.quantity === 'battery.voltage')!;

    expect(entry.estimated).toBe(4.8);
    expect(entry.measured).toBe(4.32);
    expect(entry.percentDifference).toBe(-10);
  });

  it('keeps the checklist outcome with the revision', () => {
    const revision = revisionWith([measurement('battery.voltage', 4.7)]);
    expect(revision.checklist.clearedForPower).toBe(true);
  });

  it('records a revision even when the checklist blocked power', () => {
    // The record of a blocked attempt is worth keeping; it just cannot claim
    // the unit was powered.
    const items = buildPrePowerChecklist(requireKit('motion-starter'));
    const revision = createPrototypeRevision({
      identity: IDENTITY,
      graph: loopGraph(),
      checklist: evaluateChecklist(items, {}),
      flash: null,
      measurements: [],
      evidence: [],
      savedAt: FIXED_TIME,
    });

    expect(revision.checklist.clearedForPower).toBe(false);
    expect(revision.standing).toBe('UNVALIDATED');
  });

  it('sorts measurements and evidence into a stable order', () => {
    const revision = revisionWith([
      measurement('runtime', 1.1),
      measurement('battery.voltage', 4.7),
    ]);
    expect(revision.measurements.map(m => m.id)).toEqual([...revision.measurements.map(m => m.id)].sort());
    expect(revision.evidence.map(e => e.ref)).toEqual([...revision.evidence.map(e => e.ref)].sort());
  });

  it('produces the same revision id for the same inputs', () => {
    const readings = [measurement('battery.voltage', 4.7)];
    expect(revisionWith(readings).revisionId).toBe(revisionWith(readings).revisionId);
  });

  it('produces a different revision id when the readings differ', () => {
    const a = revisionWith([measurement('battery.voltage', 4.7)]);
    const b = revisionWith([measurement('battery.voltage', 4.7, { id: 'm_other' })]);
    expect(b.revisionId).not.toBe(a.revisionId);
  });
});

describe('Gate 7 — upgrade recommendations', () => {
  it('asks for the remaining measurements while the set is incomplete', () => {
    const revision = revisionWith([measurement('battery.voltage', 4.7)]);
    const ids = revision.upgradeRecommendations.map(r => r.id);
    expect(ids).toContain('measure.remaining-quantities');
  });

  it('recommends more capacity when measured runtime falls well short', () => {
    const readings = REQUIRED_QUANTITIES.map(q =>
      measurement(q, q === 'runtime' ? 0.8 : 1));
    const revision = revisionWith(readings);

    const recommendation = revision.upgradeRecommendations
      .find(r => r.id === 'upgrade.pack-capacity');
    expect(recommendation).toBeDefined();
    expect(recommendation?.drivenByQuantity).toBe('runtime');
    expect(recommendation?.upgradeOptionId).toBe('upgrade-battery-module');
  });

  it('does not recommend anything from a gap that was never measured', () => {
    // With nothing measured, no recommendation may cite a measured quantity.
    const revision = revisionWith([]);
    for (const recommendation of revision.upgradeRecommendations) {
      expect(recommendation.drivenByQuantity).toBeNull();
    }
  });

  it('flags a peak current well above what was estimated', () => {
    const readings = REQUIRED_QUANTITIES.map(q =>
      measurement(q, q === 'motor.peakCurrent' ? 2.4 : 1));
    const revision = revisionWith(readings);

    expect(revision.upgradeRecommendations.map(r => r.id))
      .toContain('upgrade.supply-headroom');
  });

  it('returns recommendations in a stable order', () => {
    const revision = revisionWith([measurement('battery.voltage', 4.7)]);
    const ids = revision.upgradeRecommendations.map(r => r.id);
    expect(ids).toEqual([...ids].sort());
  });
});
