import { describe, it, expect } from 'vitest';
import {
  INTEGRITY_ERRORS,
  PIPELINE_ERRORS,
  PR_TRANSITIONS,
  RULE_ERRORS,
  canRetrigger,
  checkIntegrity,
  parseRuleset,
  releasePayment,
  runPipeline,
  transitionPullRequest,
  type PipelineRun,
  type PullRequestState,
} from '../src/index.js';
import {
  FIXTURE_NODE_IDS,
  FOUR_NODE_PLAN,
  boundarySubmission,
  hairOutsideSubmission,
  incompleteSubmission,
  passingSubmission,
  payload,
  replayedSubmission,
  reorderedSubmission,
  sealed,
  stream,
  tampered,
} from '../src/telemetry/fixtures.js';

const RULESET = parseRuleset(`
rules:
  - property: diameter_mm
    target: 25.00
    tolerance: 0.05
  - property: weight_grams
    target: 142.5
    tolerance: 0.2
  - property: imu_6dof_drift
    max_allowed: 0.02
`);

function run(submission: unknown, options: {
  requiredNodeIds?: readonly string[];
  evaluatedDigests?: readonly string[];
} = {}): PipelineRun {
  return runPipeline({
    submission,
    ruleset: RULESET,
    requiredNodeIds: options.requiredNodeIds ?? FIXTURE_NODE_IDS,
    evaluatedDigests: options.evaluatedDigests,
  });
}

describe('adversarial telemetry', () => {
  it('rejects a replayed frame', () => {
    const result = run(replayedSubmission());

    expect(result.state).toBe('FAILED');
    expect(result.codes).toContain(INTEGRITY_ERRORS.replayedFrame);
  });

  it('rejects frames that arrive out of order', () => {
    const result = run(reorderedSubmission());

    expect(result.state).toBe('FAILED');
    expect(result.codes).toContain(INTEGRITY_ERRORS.nonMonotonicSequence);
  });

  it('allows equal timestamps but not earlier ones', () => {
    // Real nodes emit several frames inside one millisecond. That is why
    // sequence exists — a timestamp alone cannot tell a fast node from a
    // replayed one.
    const sameMs = sealed(payload([
      {
        nodeId: 'imu-01', nodeKind: 'imu', nodeRevision: 'fw', unit: 'deg',
        frames: [
          { sequence: 0, timestampMs: 100, values: { imu_6dof_drift: 0.001 } },
          { sequence: 1, timestampMs: 100, values: { imu_6dof_drift: 0.002 } },
        ],
      },
    ]));

    expect(checkIntegrity(sameMs.payload, ['imu-01']).ok).toBe(true);

    const backwards = sealed(payload([
      {
        nodeId: 'imu-01', nodeKind: 'imu', nodeRevision: 'fw', unit: 'deg',
        frames: [
          { sequence: 0, timestampMs: 100, values: { imu_6dof_drift: 0.001 } },
          { sequence: 1, timestampMs: 99, values: { imu_6dof_drift: 0.002 } },
        ],
      },
    ]));

    expect(checkIntegrity(backwards.payload, ['imu-01']).violations.map(v => v.code))
      .toContain(INTEGRITY_ERRORS.nonMonotonicTime);
  });

  it('halts on a partial submission rather than scoring what arrived', () => {
    // Three of four required nodes. Scoring the three would make the cheapest
    // way to pass "omit the node that would have failed".
    const result = run(incompleteSubmission(), { requiredNodeIds: FOUR_NODE_PLAN });

    expect(result.state).toBe('FAILED');
    expect(result.codes).toContain(INTEGRITY_ERRORS.incompleteTelemetry);
    expect(result.detail).toContain('not a partial pass');
    // No rules were run at all — there was nothing complete to evaluate.
    expect(result.rules).toBeNull();
  });

  it('rejects two streams claiming the same node', () => {
    const duplicate = sealed(payload([
      stream({ nodeId: 'imu-01', nodeKind: 'imu', unit: 'deg', values: { imu_6dof_drift: 0.9 } }),
      stream({ nodeId: 'imu-01', nodeKind: 'imu', unit: 'deg', values: { imu_6dof_drift: 0.001 } }),
    ]));

    const result = run(duplicate, { requiredNodeIds: ['imu-01'] });

    expect(result.codes).toContain(INTEGRITY_ERRORS.duplicateNode);
  });

  it('refuses a tampered payload before any rule is evaluated', () => {
    const submission = tampered(passingSubmission().payload, p => {
      p.streams[0]!.frames[2]!.values.diameter_mm = 25.0001;
      return p;
    });

    const result = run(submission);

    expect(result.state).toBe('FAILED');
    // A rule run against bytes nobody vouched for measures nothing.
    expect(result.rules).toBeNull();
  });
});

describe('deadlock and replay prevention', () => {
  it('refuses to re-evaluate a digest this pull request already judged', () => {
    const submission = hairOutsideSubmission();
    const first = run(submission);
    expect(first.state).toBe('FAILED');

    const second = run(submission, { evaluatedDigests: [first.digest] });

    expect(second.codes).toEqual([PIPELINE_ERRORS.alreadyEvaluated]);
    expect(second.detail).toContain('Push a new inspection');
  });

  it('allows a genuinely new payload, which necessarily has a new digest', () => {
    const rejected = run(hairOutsideSubmission());
    const fixed = run(passingSubmission(), { evaluatedDigests: [rejected.digest] });

    expect(fixed.state).toBe('PASSED');
  });

  it('states the retrigger rule directly', () => {
    const digest = 'a'.repeat(64);
    expect(canRetrigger(digest, [digest]).allowed).toBe(false);
    expect(canRetrigger(digest, []).allowed).toBe(true);
  });

  it('has no transition out of FAILED', () => {
    // A rejected submission cannot be re-evaluated into a pass. The only way
    // forward is a fresh payload.
    expect(PR_TRANSITIONS.FAILED).toEqual([]);
    for (const target of ['PASSED', 'EVALUATING', 'MERGED'] as PullRequestState[]) {
      expect(transitionPullRequest('FAILED', target).valid, target).toBe(false);
    }
  });

  it('treats MERGED as terminal', () => {
    expect(PR_TRANSITIONS.MERGED).toEqual([]);
  });

  it('will not let a draft skip inspection', () => {
    expect(transitionPullRequest('DRAFT', 'PASSED').valid).toBe(false);
    expect(transitionPullRequest('DRAFT', 'MERGED').valid).toBe(false);
    expect(transitionPullRequest('DRAFT', 'IN_INSPECTION').valid).toBe(true);
  });

  it('walks the whole happy path one legal step at a time', () => {
    const path: PullRequestState[] = ['DRAFT', 'IN_INSPECTION', 'EVALUATING', 'PASSED', 'MERGED'];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(transitionPullRequest(path[i]!, path[i + 1]!).valid, `${path[i]} -> ${path[i + 1]}`)
        .toBe(true);
    }
  });

  it('lets a passed submission still fail later review', () => {
    // PASSED means the rules held, not that a human accepted it.
    expect(transitionPullRequest('PASSED', 'FAILED').valid).toBe(true);
  });
});

describe('the merge gate and payment release', () => {
  it('passes a part inside every bound and exits 0', () => {
    const result = run(passingSubmission());

    expect(result.state).toBe('PASSED');
    expect(result.ciStatus).toBe(0);
    expect(result.codes).toEqual([]);
  });

  it('passes a part sitting exactly on its limit', () => {
    const result = run(boundarySubmission());
    expect(result.state).toBe('PASSED');
  });

  it('fails a part a hair outside and exits non-zero', () => {
    const result = run(hairOutsideSubmission());

    expect(result.state).toBe('FAILED');
    expect(result.ciStatus).toBe(1);
    expect(result.codes).toContain(RULE_ERRORS.toleranceBreach);
  });

  it('releases payment only from PASSED with ciStatus 0', () => {
    expect(releasePayment(run(passingSubmission())).released).toBe(true);
  });

  it('holds payment on any failure', () => {
    for (const submission of [
      hairOutsideSubmission(), replayedSubmission(), reorderedSubmission(),
    ]) {
      const decision = releasePayment(run(submission));
      expect(decision.released).toBe(false);
    }
  });

  it('holds payment when state and ciStatus disagree', () => {
    // If these ever contradict each other the pipeline is wrong, not the part.
    // The money stays put either way.
    const contradiction: PipelineRun = {
      ...run(passingSubmission()),
      ciStatus: 1,
    };

    const decision = releasePayment(contradiction);

    expect(decision.released).toBe(false);
    expect(decision.reason).toContain('the pipeline is wrong');
  });

  it('never releases from any state other than PASSED', () => {
    const passed = run(passingSubmission());
    for (const state of ['DRAFT', 'IN_INSPECTION', 'EVALUATING', 'FAILED', 'MERGED'] as const) {
      expect(releasePayment({ ...passed, state }).released, state).toBe(false);
    }
  });

  it('takes no override argument', () => {
    // A gate that can be forced is not a gate. Adding a bypass would have to
    // change this arity, which a reviewer would see in the diff.
    expect(releasePayment.length).toBe(1);
  });

  it('is deterministic end to end', () => {
    const a = run(passingSubmission());
    const b = run(passingSubmission());
    expect(a).toEqual(b);
  });

  it('reaches the same verdict regardless of stream order in the payload', () => {
    const forward = passingSubmission();
    const reversed = sealed(payload([...forward.payload.streams].reverse()));

    expect(run(reversed).state).toBe(run(forward).state);
  });
});
