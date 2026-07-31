import { describe, it, expect } from 'vitest';
import {
  DIGEST_ERRORS,
  sealPayload,
  telemetryDigest,
  verifySubmission,
} from '../src/telemetry/digest.js';
import {
  FIXTURE_SERIAL_PREFIX,
  passingSubmission,
  payload,
  sealed,
  stream,
  tampered,
} from '../src/telemetry/fixtures.js';

const base = () => payload([
  stream({ nodeId: 'micrometer-01', nodeKind: 'micrometer', unit: 'mm', values: { diameter_mm: 25 } }),
]);

describe('telemetry digests — identity is content', () => {
  it('produces a lowercase sha256 hex digest', () => {
    expect(telemetryDigest(base())).toMatch(/^[a-f0-9]{64}$/);
  });

  it('gives the same payload the same digest every time', () => {
    expect(telemetryDigest(base())).toBe(telemetryDigest(base()));
  });

  it('ignores key order, because JSON key order is not content', () => {
    const a = base();
    const b = JSON.parse(JSON.stringify({
      streams: a.streams,
      capturedAt: a.capturedAt,
      serialNumber: a.serialNumber,
      partNumber: a.partNumber,
      vendorId: a.vendorId,
      submissionId: a.submissionId,
    }));

    expect(telemetryDigest(b)).toBe(telemetryDigest(a));
  });

  it('changes when a single coordinate moves in the fourth decimal place', () => {
    const before = base();
    const after = structuredClone(before);
    after.streams[0]!.frames[0]!.values.diameter_mm = 25.0001;

    // 25.0000 -> 25.0001. One digit. Different object.
    expect(telemetryDigest(after)).not.toBe(telemetryDigest(before));
  });

  it('changes when any field changes at all', () => {
    const before = base();
    for (const mutate of [
      (p: ReturnType<typeof base>) => { p.serialNumber = `${FIXTURE_SERIAL_PREFIX}9999`; },
      (p: ReturnType<typeof base>) => { p.capturedAt = '2026-03-01T09:00:00.001Z'; },
      (p: ReturnType<typeof base>) => { p.streams[0]!.nodeRevision = 'fixture-fw-0.1.1'; },
      (p: ReturnType<typeof base>) => { p.streams[0]!.frames[0]!.sequence = 99; },
      (p: ReturnType<typeof base>) => { p.streams[0]!.frames[0]!.timestampMs = 1; },
    ]) {
      const after = structuredClone(before);
      mutate(after);
      expect(telemetryDigest(after)).not.toBe(telemetryDigest(before));
    }
  });

  it('accepts a submission whose declared digest matches', () => {
    const result = verifySubmission(passingSubmission());
    expect(result.ok).toBe(true);
  });

  it('rejects a payload altered after it was sealed', () => {
    const submission = tampered(base(), p => {
      p.streams[0]!.frames[0]!.values.diameter_mm = 25.0001;
      return p;
    });

    const result = verifySubmission(submission);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe(DIGEST_ERRORS.mismatch);
    expect(result.detail).toContain('altered after it was signed');
    expect(result.computedDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a digest lifted from a different submission', () => {
    const mine = sealPayload(base());
    const theirs = sealPayload(payload([
      stream({ nodeId: 'scale-01', nodeKind: 'scale', unit: 'g', values: { weight_grams: 142.5 } }),
    ]));

    const forged = { payload: mine.payload, declaredDigest: theirs.declaredDigest };

    expect(verifySubmission(forged).ok).toBe(false);
  });

  it('rejects a malformed payload before hashing anything', () => {
    const result = verifySubmission({ payload: { submissionId: '' }, declaredDigest: 'x' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe(DIGEST_ERRORS.malformed);
    expect(result.computedDigest).toBeNull();
  });

  it('refuses a non-finite reading at the boundary', () => {
    // NaN compared against a tolerance is false in both directions, so it must
    // never reach a rule. It is refused where it arrives.
    const bad = structuredClone(base()) as unknown as Record<string, unknown>;
    (bad as never as ReturnType<typeof base>).streams[0]!.frames[0]!.values.diameter_mm = Number.NaN;

    expect(verifySubmission({ payload: bad, declaredDigest: 'a'.repeat(64) }).ok).toBe(false);
  });

  it('refuses a declared digest that is not a sha256 hex string', () => {
    for (const declared of ['', 'not-a-digest', 'A'.repeat(64), 'a'.repeat(63)]) {
      const result = verifySubmission({ payload: base(), declaredDigest: declared });
      expect(result.ok, declared).toBe(false);
    }
  });

  it('seals a payload with the digest it actually hashes to', () => {
    const submission = sealPayload(base());
    expect(verifySubmission(submission).ok).toBe(true);
  });

  it('marks every fixture serial as a fixture', () => {
    // A fixture that reads like a real inspection record is the fabrication this
    // project exists to refuse. The prefix is enforced, not just intended.
    const result = verifySubmission(passingSubmission());
    if (!result.ok) throw new Error('fixture should verify');
    expect(result.payload.serialNumber.startsWith(FIXTURE_SERIAL_PREFIX)).toBe(true);
  });

  it('is not fooled by a re-sealed tampered payload having a valid digest', () => {
    // Re-sealing makes the submission internally consistent — and gives it a
    // different name. The pipeline catches this by digest identity, not here.
    const original = sealed(base());
    const altered = structuredClone(original.payload);
    altered.streams[0]!.frames[0]!.values.diameter_mm = 25.0001;
    const resealed = sealPayload(altered);

    expect(verifySubmission(resealed).ok).toBe(true);
    expect(resealed.declaredDigest).not.toBe(original.declaredDigest);
  });
});
