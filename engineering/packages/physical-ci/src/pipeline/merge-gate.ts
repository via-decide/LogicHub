import { transition, type TransitionMap } from '@logichub-engineering/shared';
import { verifySubmission } from '../telemetry/digest.js';
import { checkIntegrity } from './integrity.js';
import { evaluateRuleset, type Ruleset, type RulesetEvaluation } from '../rules/inspection-rules.js';

/**
 * The merge gate for a physical pull request.
 *
 * A vendor's PR claims that an object they made matches a specification. The
 * gate decides whether that claim is supported. It is written the way a branch
 * protection rule is written: the gate has no override parameter, and adding one
 * would have to change this function's signature in a way a reviewer would see.
 *
 * Nothing here returns a warning. A physical part is inside its tolerance or it
 * is not, and a state that means "not quite, but proceed" is a state someone
 * eventually learns to click through.
 */

export const PR_STATES = [
  'DRAFT',
  'IN_INSPECTION',
  'EVALUATING',
  'PASSED',
  'FAILED',
  'MERGED',
] as const;

export type PullRequestState = (typeof PR_STATES)[number];

/**
 * Legal transitions.
 *
 * Note what is absent: there is no edge from FAILED to PASSED, and none from
 * FAILED back to EVALUATING. A rejected submission cannot be re-evaluated into
 * a pass. The only way forward is a fresh payload, which by construction has a
 * different digest — see `canRetrigger`.
 *
 * MERGED is terminal. So is FAILED, for that submission.
 */
export const PR_TRANSITIONS: TransitionMap<PullRequestState> = {
  DRAFT: ['IN_INSPECTION'],
  IN_INSPECTION: ['EVALUATING', 'DRAFT'],
  EVALUATING: ['PASSED', 'FAILED'],
  PASSED: ['MERGED', 'FAILED'],
  FAILED: [],
  MERGED: [],
};

export function transitionPullRequest(from: PullRequestState, to: PullRequestState) {
  return transition(from, to, PR_TRANSITIONS);
}

export interface PipelineRun {
  /** The digest of the payload this run evaluated. */
  digest: string;
  state: PullRequestState;
  /** POSIX-style: 0 is success, non-zero is not. */
  ciStatus: number;
  /** Every failure code from every stage, sorted and deduplicated. */
  codes: string[];
  rules: RulesetEvaluation | null;
  detail: string;
}

export interface RunPipelineInput {
  submission: unknown;
  ruleset: Ruleset;
  requiredNodeIds: readonly string[];
  /**
   * Digests this pull request has already evaluated.
   *
   * A vendor cannot re-run CI on a rejected commit hoping for a different
   * answer: the evaluation is deterministic, so it would give the same one, and
   * re-running it only wastes an inspection slot. Pushing a genuinely new
   * payload produces a new digest, which is not in this set.
   */
  evaluatedDigests?: readonly string[];
}

export const PIPELINE_ERRORS = {
  alreadyEvaluated: 'ERR_DIGEST_ALREADY_EVALUATED',
} as const;

/**
 * Reduce measurements from telemetry streams.
 *
 * Each stream contributes its last frame's channels, namespaced by nothing —
 * the ruleset names properties, and a node reports the properties it measures.
 * Later streams do not overwrite earlier ones silently: a channel measured by
 * two nodes is a duplicate-node violation caught upstream.
 */
export function reduceMeasurements(
  streams: readonly { frames: readonly { values: Record<string, number> }[] }[],
): Record<string, number> {
  const measured: Record<string, number> = {};
  for (const stream of streams) {
    const last = stream.frames[stream.frames.length - 1];
    if (last === undefined) continue;
    for (const [channel, value] of Object.entries(last.values)) {
      measured[channel] = value;
    }
  }
  return measured;
}

/**
 * Run the full pipeline for one submission.
 *
 * Stages run in order and the first failing stage stops the run, because a rule
 * evaluated against a payload that failed its digest check is meaningless —
 * it would be measuring bytes nobody vouched for.
 */
export function runPipeline(input: RunPipelineInput): PipelineRun {
  const evaluated = new Set(input.evaluatedDigests ?? []);

  // Stage 1 — the payload is what it says it is.
  const verified = verifySubmission(input.submission);
  if (!verified.ok) {
    return {
      digest: verified.computedDigest ?? '',
      state: 'FAILED',
      ciStatus: 1,
      codes: [verified.code],
      rules: null,
      detail: verified.detail,
    };
  }

  // Stage 2 — this exact payload has not already been judged.
  if (evaluated.has(verified.digest)) {
    return {
      digest: verified.digest,
      state: 'FAILED',
      ciStatus: 1,
      codes: [PIPELINE_ERRORS.alreadyEvaluated],
      rules: null,
      detail:
        `Digest ${verified.digest} has already been evaluated on this pull request. `
        + 'Evaluation is deterministic, so re-running it cannot produce a different '
        + 'answer. Push a new inspection to get a new digest.',
    };
  }

  // Stage 3 — the capture looks like a capture.
  const integrity = checkIntegrity(verified.payload, input.requiredNodeIds);
  if (!integrity.ok) {
    return {
      digest: verified.digest,
      state: 'FAILED',
      ciStatus: 1,
      codes: [...new Set(integrity.violations.map(v => v.code))].sort(),
      rules: null,
      detail: integrity.violations.map(v => v.detail).join(' '),
    };
  }

  // Stage 4 — the readings meet the specification.
  const rules = evaluateRuleset(input.ruleset, reduceMeasurements(verified.payload.streams));

  return {
    digest: verified.digest,
    state: rules.passed ? 'PASSED' : 'FAILED',
    ciStatus: rules.passed ? 0 : 1,
    codes: rules.codes,
    rules,
    detail: rules.passed
      ? `All ${rules.findings.length} rules evaluated true.`
      : rules.findings.filter(f => !f.passed).map(f => f.detail).join(' '),
  };
}

export interface PaymentDecision {
  released: boolean;
  reason: string;
}

/**
 * Whether funds may be released.
 *
 * Strictly: the run must have reached PASSED *and* reported ciStatus 0. Both are
 * checked rather than one being trusted to imply the other, because they are set
 * in different places and a future edit could separate them. If they ever
 * disagree, that is a bug in the pipeline and the money stays put.
 *
 * There is no argument for skipping this and no flag to force it.
 */
export function releasePayment(run: PipelineRun): PaymentDecision {
  if (run.state !== 'PASSED') {
    return {
      released: false,
      reason: `State is ${run.state}. Funds release only from PASSED.`,
    };
  }

  if (run.ciStatus !== 0) {
    return {
      released: false,
      reason:
        `State is PASSED but ciStatus is ${run.ciStatus}. These disagree, which means `
        + 'the pipeline is wrong, not that the part is good. Nothing is released.',
    };
  }

  return { released: true, reason: 'All rules evaluated true and CI exited 0.' };
}

/**
 * Whether a pull request may run CI again.
 *
 * Only with a payload it has not already judged. This is what stops the loop
 * where a vendor re-triggers a rejected commit until something flakes — there is
 * nothing to flake, but the rule is stated explicitly so that remains true if
 * the pipeline ever gains a non-deterministic stage.
 */
export function canRetrigger(
  digest: string,
  evaluatedDigests: readonly string[],
): { allowed: boolean; reason: string } {
  if (evaluatedDigests.includes(digest)) {
    return {
      allowed: false,
      reason:
        'This payload has already been evaluated. A fresh inspection produces a '
        + 'different digest; the same bytes produce the same verdict.',
    };
  }
  return { allowed: true, reason: 'New payload digest.' };
}
