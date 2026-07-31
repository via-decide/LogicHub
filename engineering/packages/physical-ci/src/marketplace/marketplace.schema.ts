import { z } from 'zod';
import { ISODateTimeSchema, CURRENT_SCHEMA_VERSION, Sha256Schema } from '@logichub-engineering/shared';
import { PriceQuoteSchema } from '@logichub-engineering/commerce';
import { PR_STATES } from '../pipeline/merge-gate.js';

/**
 * The marketplace domain: an `Issue` a creator posts, a `Claim` a vendor makes
 * on it, the `PhysicalPullRequest` that claim becomes, and the `CiRun`s that
 * evaluate it. This is the part of the system that has a UI and an API
 * surface; `../pipeline` and `../rules` stay the pure, database-free engine
 * underneath it.
 *
 * Bounty is `PriceQuoteSchema`, reused from `@logichub-engineering/commerce`
 * rather than a plain number — that schema is a tagged union
 * (`UNAVAILABLE` | `QUOTED`) specifically so an unpriced amount cannot be
 * read as a price of zero. An `Issue` with no bounty set yet must not sum
 * into a total the way `{ amount: 0 }` would.
 */

export const IssueStatusSchema = z.enum(['OPEN', 'CLAIMED', 'CLOSED']);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;

export const IssueSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  repositoryId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  /** The YAML text a submission against this issue is evaluated against. */
  rulesetYaml: z.string().min(1),
  /** Node ids `checkCompleteness` requires present in every submission. */
  requiredNodeIds: z.array(z.string().min(1)).min(1),
  bounty: PriceQuoteSchema,
  status: IssueStatusSchema,
  createdAt: ISODateTimeSchema,
  createdBy: z.string().min(1),
});
export type Issue = z.infer<typeof IssueSchema>;

export const ClaimSchema = z.object({
  id: z.string().min(1),
  issueId: z.string().min(1),
  vendorId: z.string().min(1),
  /** The vendor's working branch, forked from the issue's repository. */
  branchName: z.string().min(1),
  claimedAt: ISODateTimeSchema,
});
export type Claim = z.infer<typeof ClaimSchema>;

/** Reuses `pipeline/merge-gate.ts`'s own state list — one state machine, not two. */
export const PullRequestStateSchema = z.enum(PR_STATES);

export const PhysicalPullRequestSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  issueId: z.string().min(1),
  claimId: z.string().min(1),
  vendorId: z.string().min(1),
  state: PullRequestStateSchema,
  /** Digests this PR has already had evaluated — mirrors `RunPipelineInput.evaluatedDigests`. */
  evaluatedDigests: z.array(Sha256Schema),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
});
export type PhysicalPullRequest = z.infer<typeof PhysicalPullRequestSchema>;

/**
 * One persisted execution of `runPipeline` against a `PhysicalPullRequest`.
 *
 * Carries the same fields `PipelineRun` returns (digest, state, ciStatus,
 * codes, detail) plus the bookkeeping the engine itself doesn't need: which
 * PR this run belongs to, and when it happened. Kept as a separate type
 * rather than reusing `PipelineRun` directly so the persisted shape can
 * evolve (e.g. gain a stored `id`) without touching the pure pipeline's
 * return type.
 */
/**
 * Mirrors `rules/inspection-rules.ts`'s `RuleFinding` (a plain TS interface
 * there, not a zod schema — redeclared here rather than imported so this
 * package's own public marketplace types don't reach back into an internal
 * pipeline module's shape).
 */
export const RuleFindingSchema = z.object({
  property: z.string(),
  passed: z.boolean(),
  code: z.string().nullable(),
  observed: z.number().nullable(),
  lowerBound: z.number().nullable(),
  upperBound: z.number().nullable(),
  detail: z.string(),
});
export type RuleFinding = z.infer<typeof RuleFindingSchema>;

export const CiRunSchema = z.object({
  id: z.string().min(1),
  pullRequestId: z.string().min(1),
  digest: Sha256Schema.or(z.literal('')),
  state: PullRequestStateSchema,
  ciStatus: z.number().int(),
  codes: z.array(z.string()),
  detail: z.string(),
  /**
   * Per-property findings, or null when the run never reached rule
   * evaluation at all (a digest mismatch or an already-evaluated digest,
   * both rejected before this stage — see `pipeline/merge-gate.ts`'s
   * `runPipeline`, which sets its own `rules: null` in exactly those cases).
   */
  rules: z.object({
    passed: z.boolean(),
    findings: z.array(RuleFindingSchema),
    codes: z.array(z.string()),
  }).nullable(),
  evaluatedAt: ISODateTimeSchema,
});
export type CiRun = z.infer<typeof CiRunSchema>;

/**
 * One condition `releasePayment`-adjacent UI needs to show before funds could
 * ever move. `PENDING` is a real, distinct state — not a synonym for
 * `PASSED` and not something `allConditionsMet` below treats as satisfied.
 * A single `PENDING` condition blocks release exactly as a `FAILED` one does;
 * the only way through is every condition reaching `PASSED`.
 */
export const ReleaseConditionStatusSchema = z.enum(['PASSED', 'FAILED', 'PENDING']);
export type ReleaseConditionStatus = z.infer<typeof ReleaseConditionStatusSchema>;

export const ReleaseConditionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: ReleaseConditionStatusSchema,
  detail: z.string(),
});
export type ReleaseCondition = z.infer<typeof ReleaseConditionSchema>;
