import { describe, it, expect } from 'vitest';
import { ProductRepository } from '../src/repository/product-repository.js';
import { semanticDiff } from '../src/diff/semantic-diff.js';
import {
  detectStaleDecisions,
  detectStaleEvidence,
  touchedSubjects,
} from '../src/governance/staleness.js';
import { decideRelease } from '../src/governance/release.js';
import type {
  EvidenceBinding,
  ReviewRecord,
  ValidationDecision,
} from '../src/schemas/governance.schema.js';
import { FIXED_TIME, INTENT, STAMP, roverGraph } from './helpers.js';

function seed() {
  const repo = new ProductRepository();
  const first = repo.commit({
    intent: INTENT, stamp: STAMP, graph: roverGraph(3),
    author: 'tester', message: 'Initial rover', createdAt: FIXED_TIME,
  });
  return { repo, first };
}

function decision(revisionId: string, subject: string): ValidationDecision {
  return {
    id: `dec_${subject}`,
    revisionId,
    subject,
    verdict: 'ACCEPTED',
    rationale: 'Reviewed on the bench and accepted.',
    decidedBy: 'reviewer',
    decidedAt: FIXED_TIME,
  };
}

function binding(revisionId: string, subjects: string[]): EvidenceBinding {
  return {
    ref: `ev_${subjects.join('_')}`,
    revisionId,
    hardwareRevision: STAMP.hardware,
    firmwareRevision: STAMP.firmware,
    subjects,
    capturedAt: FIXED_TIME,
    sha256: 'a'.repeat(64),
  };
}

const APPROVED: ReviewRecord = {
  revisionId: 'ignored',
  reviewedBy: 'reviewer',
  reviewedAt: FIXED_TIME,
  verdict: 'APPROVED',
  notes: '',
};

describe('Gate 8 — repository history', () => {
  it('keeps an append-only line of revisions', () => {
    const { repo, first } = seed();
    const second = repo.commit({
      intent: INTENT, stamp: STAMP, graph: roverGraph(4),
      author: 'tester', message: 'Move to 4S', createdAt: FIXED_TIME,
    });

    expect(second.parentRevisionId).toBe(first.revisionId);
    expect(repo.history(second.revisionId).map(r => r.revisionId))
      .toEqual([second.revisionId, first.revisionId]);
    expect(repo.size()).toBe(2);
  });

  it('leaves a superseded revision exactly as it was committed', () => {
    const { repo, first } = seed();
    const before = JSON.stringify(first);
    repo.commit({
      intent: INTENT, stamp: STAMP, graph: roverGraph(4),
      author: 'tester', message: 'Move to 4S', createdAt: FIXED_TIME,
    });
    expect(JSON.stringify(repo.require(first.revisionId))).toBe(before);
  });

  it('records the four revision streams separately', () => {
    const { first } = seed();
    expect(first.stamp).toEqual({
      hardware: 'hw-a', firmware: 'fw-1.0.0', application: 'app-1.0.0', enclosure: 'enc-none',
    });
  });

  it('carries product intent with every revision', () => {
    const { first } = seed();
    expect(first.intent.targetProductTemplateIds).toContain('bluetooth-rover');
  });

  it('refuses to record a decision against a revision it does not have', () => {
    const { repo } = seed();
    expect(() => repo.recordDecision(decision('rev_missing', 'motor.voltage')))
      .toThrow(/Unknown revision/);
  });

  it('does not inherit decisions from an ancestor revision', () => {
    // A judgement about an earlier design is not a judgement about this one.
    const { repo, first } = seed();
    repo.recordDecision(decision(first.revisionId, 'motor.voltage'));

    const second = repo.commit({
      intent: INTENT, stamp: STAMP, graph: roverGraph(4),
      author: 'tester', message: 'Move to 4S', createdAt: FIXED_TIME,
    });

    expect(repo.decisionsFor(second.revisionId)).toEqual([]);
    // The ancestor's decision is still findable, tagged with where it came from.
    expect(repo.decisionHistory(second.revisionId).map(d => d.revisionId))
      .toEqual([first.revisionId]);
  });

  it('keeps evidence findable across history without migrating it', () => {
    const { repo, first } = seed();
    repo.recordEvidence(binding(first.revisionId, ['battery.voltage']));

    const second = repo.commit({
      intent: INTENT, stamp: STAMP, graph: roverGraph(4),
      author: 'tester', message: 'Move to 4S', createdAt: FIXED_TIME,
    });

    expect(repo.evidenceFor(second.revisionId)).toEqual([]);
    expect(repo.evidenceHistory(second.revisionId)).toHaveLength(1);
  });
});

describe('Gate 8 — staleness', () => {
  function batteryChangeDiff() {
    const { repo, first } = seed();
    const second = repo.commit({
      intent: INTENT, stamp: STAMP, graph: roverGraph(4),
      author: 'tester', message: 'Move to 4S', createdAt: FIXED_TIME,
    });
    return { repo, first, second, diff: semanticDiff(first, second) };
  }

  it('lists the subjects a change touched', () => {
    const { diff } = batteryChangeDiff();
    const subjects = touchedSubjects(diff);
    expect(subjects).toContain('battery.cellCount');
    expect(subjects).toContain('Thermal load');
  });

  it('marks a decision stale when its subject changed', () => {
    const { first, diff } = batteryChangeDiff();
    const stale = detectStaleDecisions([decision(first.revisionId, 'battery.cellCount')], diff);

    expect(stale).toHaveLength(1);
    expect(stale[0].reason).toBe('subject-changed');
    expect(stale[0].message).toMatch(/does not carry forward and must be made again/);
  });

  it('leaves a decision alone when its subject did not change', () => {
    const { first, diff } = batteryChangeDiff();
    expect(detectStaleDecisions([decision(first.revisionId, 'enclosure.material')], diff))
      .toEqual([]);
  });

  it('marks evidence stale when the subject it speaks to changed', () => {
    const { first, diff } = batteryChangeDiff();
    const stale = detectStaleEvidence(
      [binding(first.revisionId, ['battery.cellCount'])], diff, STAMP,
    );

    expect(stale).toHaveLength(1);
    expect(stale[0].reason).toBe('subject-changed');
    expect(stale[0].message).toMatch(/no longer describes the current design/);
  });

  it('marks evidence stale when the hardware it was taken on moved', () => {
    const { first, diff } = batteryChangeDiff();
    const stale = detectStaleEvidence(
      [binding(first.revisionId, ['unrelated'])],
      diff,
      { ...STAMP, hardware: 'hw-b' },
    );

    expect(stale[0].reason).toBe('hardware-revision-changed');
    expect(stale[0].message).toMatch(/does not describe this build/);
  });

  it('marks evidence stale when the firmware it was taken on moved', () => {
    const { first, diff } = batteryChangeDiff();
    const stale = detectStaleEvidence(
      [binding(first.revisionId, ['unrelated'])],
      diff,
      { ...STAMP, firmware: 'fw-2.0.0' },
    );
    expect(stale[0].reason).toBe('firmware-revision-changed');
  });

  it('keeps evidence that still describes this build and subject', () => {
    const { first, diff } = batteryChangeDiff();
    expect(detectStaleEvidence([binding(first.revisionId, ['unrelated'])], diff, STAMP))
      .toEqual([]);
  });

  it('reports staleness in a stable order', () => {
    const { first, diff } = batteryChangeDiff();
    const records = detectStaleDecisions([
      decision(first.revisionId, 'battery.cellCount'),
      decision(first.revisionId, 'battery'),
    ], diff);
    expect(records.map(r => r.id)).toEqual([...records.map(r => r.id)].sort());
  });
});

describe('Gate 8 — release', () => {
  function releaseFor(overrides: Partial<Parameters<typeof decideRelease>[0]> = {}) {
    const { repo, first } = seed();
    const second = repo.commit({
      intent: INTENT, stamp: STAMP, graph: roverGraph(4),
      author: 'tester', message: 'Move to 4S', createdAt: FIXED_TIME,
    });
    return decideRelease({
      revisionId: second.revisionId,
      diff: semanticDiff(first, second),
      review: APPROVED,
      staleRecords: [],
      ...overrides,
    });
  }

  it('blocks a release with a failed validation check', () => {
    const decisionResult = releaseFor();
    expect(decisionResult.released).toBe(false);
    expect(decisionResult.blockers.map(b => b.code)).toContain('release.validation-failed');
  });

  it('blocks a release on a check that could not be evaluated', () => {
    // An unrun check is not a passed check, so it cannot be released past.
    expect(releaseFor().blockers.map(b => b.code)).toContain('release.validation-unknown');
  });

  it('blocks a release on an affected area nobody evaluated', () => {
    expect(releaseFor().blockers.map(b => b.code)).toContain('release.area-unevaluated');
  });

  it('blocks a release on stale evidence', () => {
    const result = releaseFor({
      staleRecords: [{
        id: 'ev_1', kind: 'evidence', reason: 'subject-changed', subject: 'battery.cellCount',
        fromRevisionId: 'rev_old', message: 'Evidence went stale.',
      }],
    });
    expect(result.blockers.map(b => b.code)).toContain('release.stale-evidence');
  });

  it('blocks a release that has not been reviewed', () => {
    expect(releaseFor({ review: null }).blockers.map(b => b.code)).toContain('release.no-review');
  });

  it('blocks a release when the reviewer requested changes', () => {
    const result = releaseFor({
      review: { ...APPROVED, verdict: 'CHANGES_REQUESTED' },
    });
    expect(result.blockers.map(b => b.code)).toContain('release.changes-requested');
  });

  it('releases only when nothing at all is outstanding', () => {
    const result = decideRelease({
      revisionId: 'rev_clean',
      diff: {
        fromRevisionId: null,
        toRevisionId: 'rev_clean',
        changes: [],
        affectedAreas: [],
        validationChecks: [
          { id: 'ok', label: 'Everything', verdict: 'PASS', detail: 'Checked.' },
        ],
        hasFailures: false,
        hasUnevaluatedAreas: false,
        summary: 'Clean.',
      },
      review: APPROVED,
      staleRecords: [],
    });

    expect(result.released).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.summary).toMatch(/may be released/);
  });

  it('reports blockers in a stable order', () => {
    const codes = releaseFor().blockers.map(b => b.code);
    expect(codes).toEqual([...codes].sort());
  });
});
