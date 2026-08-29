"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge, GateDot } from "@/lib/status-badge";
import {
  submitReview,
  recalculateEligibility,
  mergePullRequest,
  closePullRequest,
  ApiError,
  type EngineeringPullRequest,
  type Revision,
  type RevisionComparisonResult,
  type ValidationResult,
  type ChangeIntent,
  type MergeGateResult,
} from "@/lib/logichub-api";

const TABS = [
  "Overview",
  "Intent",
  "Files",
  "Schematic",
  "PCB",
  "BOM",
  "Constraints",
  "Decisions",
  "Validation",
  "Reviews",
] as const;
type Tab = (typeof TABS)[number];

export function PrView({
  pullRequest,
  baseRevision,
  headRevision,
  diff,
  headValidations,
  changeIntent,
}: {
  pullRequest: EngineeringPullRequest;
  baseRevision: Revision | null;
  headRevision: Revision | null;
  diff: RevisionComparisonResult | null;
  headValidations: ValidationResult[];
  changeIntent: ChangeIntent | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [gateResult, setGateResult] = useState<MergeGateResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [comment, setComment] = useState("");
  const [mergedBy, setMergedBy] = useState("");

  const isTerminal = pullRequest.status === "merged" || pullRequest.status === "closed" || pullRequest.status === "rejected";

  useEffect(() => {
    if (isTerminal) return;
    recalculateEligibility(pullRequest.id)
      .then(setGateResult)
      .catch(() => undefined);
    // Recalculate is idempotent and side-effect-safe to call on load -- it
    // reflects "recalculated immediately before merge, never a stale cache".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullRequest.id]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setErrorMessage(null);
    try {
      await action();
      router.refresh();
      const fresh = await recalculateEligibility(pullRequest.id).catch(() => null);
      if (fresh) setGateResult(fresh);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? `${err.code}: ${err.message}` : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const deltas = diff?.semDiff.deltas ?? [];
  const deltasByDomain = (domain: string) => deltas.filter((d) => d.domain === domain);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs text-zinc-500">#{pullRequest.number}</p>
          <h1 className="text-2xl font-bold">{pullRequest.title}</h1>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            {pullRequest.baseBranch} ← {pullRequest.headBranch} · opened by {pullRequest.author}
          </p>
        </div>
        <StatusBadge status={pullRequest.status} />
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      <ActionBar
        busy={busy}
        isTerminal={isTerminal}
        reviewer={reviewer}
        setReviewer={setReviewer}
        comment={comment}
        setComment={setComment}
        mergedBy={mergedBy}
        setMergedBy={setMergedBy}
        onComment={() => run("comment", () => submitReview(pullRequest.id, { reviewer, decision: "comment", comment }))}
        onApprove={() => run("approve", () => submitReview(pullRequest.id, { reviewer, decision: "approve", comment }))}
        onRequestChanges={() =>
          run("request_changes", () => submitReview(pullRequest.id, { reviewer, decision: "request_changes", comment }))
        }
        onRecalculate={() => run("recalculate", async () => setGateResult(await recalculateEligibility(pullRequest.id)))}
        onMerge={() => run("merge", () => mergePullRequest(pullRequest.id, mergedBy))}
        onClose={() => run("close", () => closePullRequest(pullRequest.id))}
      />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium transition ${
              tab === t ? "border-b-2 border-amber-400 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <OverviewTab
          pullRequest={pullRequest}
          baseRevision={baseRevision}
          headRevision={headRevision}
          diff={diff}
          gateResult={gateResult}
        />
      )}
      {tab === "Intent" && <IntentTab changeIntent={changeIntent} />}
      {tab === "Files" && <DeltaTab deltas={deltas} emptyLabel="No file-level changes detected." />}
      {tab === "Schematic" && <DeltaTab deltas={deltasByDomain("schematic")} emptyLabel="No schematic changes." visualNote />}
      {tab === "PCB" && <DeltaTab deltas={deltasByDomain("pcb")} emptyLabel="No PCB changes." visualNote />}
      {tab === "BOM" && <BomTab deltas={deltasByDomain("bom")} diff={diff} />}
      {tab === "Constraints" && <ConstraintsTab diff={diff} />}
      {tab === "Decisions" && (
        <EmptyPanel>
          Not yet exposed by the API surface (master spec section 12 does not list a decisions-list
          endpoint) -- required decision records are still checked by merge gate #12 server-side.
        </EmptyPanel>
      )}
      {tab === "Validation" && <ValidationTab validations={headValidations} gateResult={gateResult} />}
      {tab === "Reviews" && <ReviewsTab pullRequest={pullRequest} />}
    </main>
  );
}

function ActionBar(props: {
  busy: string | null;
  isTerminal: boolean;
  reviewer: string;
  setReviewer: (v: string) => void;
  comment: string;
  setComment: (v: string) => void;
  mergedBy: string;
  setMergedBy: (v: string) => void;
  onComment: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onRecalculate: () => void;
  onMerge: () => void;
  onClose: () => void;
}) {
  const disabled = props.isTerminal;
  const reviewDisabled = disabled || props.busy !== null || props.reviewer.trim().length === 0;
  return (
    <div className="mb-8 rounded-2xl border border-white/10 bg-zinc-900 p-4">
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={props.reviewer}
          onChange={(e) => props.setReviewer(e.target.value)}
          placeholder="Your name (reviewer)"
          disabled={disabled}
          className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm placeholder:text-zinc-600"
        />
        <input
          value={props.mergedBy}
          onChange={(e) => props.setMergedBy(e.target.value)}
          placeholder="Your name (merging as)"
          disabled={disabled}
          className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm placeholder:text-zinc-600"
        />
      </div>
      <textarea
        value={props.comment}
        onChange={(e) => props.setComment(e.target.value)}
        placeholder="Comment (optional for approve/request changes)"
        disabled={disabled}
        rows={2}
        className="mb-3 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm placeholder:text-zinc-600"
      />
      <div className="flex flex-wrap gap-2">
        <ActionButton label="Comment" busy={props.busy === "comment"} disabled={reviewDisabled} onClick={props.onComment} />
        <ActionButton label="Approve" busy={props.busy === "approve"} disabled={reviewDisabled} onClick={props.onApprove} tone="emerald" />
        <ActionButton
          label="Request changes"
          busy={props.busy === "request_changes"}
          disabled={reviewDisabled}
          onClick={props.onRequestChanges}
          tone="amber"
        />
        <ActionButton label="Recalculate eligibility" busy={props.busy === "recalculate"} disabled={disabled || props.busy !== null} onClick={props.onRecalculate} />
        <ActionButton
          label="Merge"
          busy={props.busy === "merge"}
          disabled={disabled || props.busy !== null || props.mergedBy.trim().length === 0}
          onClick={props.onMerge}
          tone="emerald"
        />
        <ActionButton label="Close" busy={props.busy === "close"} disabled={disabled || props.busy !== null} onClick={props.onClose} tone="red" />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  busy,
  disabled,
  tone,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  tone?: "emerald" | "amber" | "red";
}) {
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
        : tone === "red"
          ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
          : "border-white/15 bg-white/5 text-white hover:bg-white/10";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClasses}`}
    >
      {busy ? "…" : label}
    </button>
  );
}

function OverviewTab({
  pullRequest,
  baseRevision,
  headRevision,
  diff,
  gateResult,
}: {
  pullRequest: EngineeringPullRequest;
  baseRevision: Revision | null;
  headRevision: Revision | null;
  diff: RevisionComparisonResult | null;
  gateResult: MergeGateResult | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel title="Revisions">
        <dl className="grid grid-cols-[60px_1fr] gap-y-3 px-4 py-4 text-sm">
          <dt className="text-zinc-500">Base</dt>
          <dd>
            {baseRevision ? (
              <Link href={`/revisions/${baseRevision.id}`} className="font-mono text-xs hover:text-amber-400">
                {baseRevision.gitCommitSha.slice(0, 10)}
              </Link>
            ) : (
              <span className="text-zinc-600">unknown</span>
            )}
          </dd>
          <dt className="text-zinc-500">Head</dt>
          <dd>
            {headRevision ? (
              <Link href={`/revisions/${headRevision.id}`} className="font-mono text-xs hover:text-amber-400">
                {headRevision.gitCommitSha.slice(0, 10)}
              </Link>
            ) : (
              <span className="text-zinc-600">unknown</span>
            )}
          </dd>
          <dt className="text-zinc-500">Approvals</dt>
          <dd>
            {pullRequest.approvals.length} recorded / {pullRequest.requiredApprovals} required
          </dd>
        </dl>
      </Panel>

      <Panel title="Change summary">
        {diff ? (
          <ul className="divide-y divide-white/5">
            {Object.entries(diff.semDiff.prSummary.changeCountsByDomain).map(([domain, count]) => (
              <li key={domain} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="capitalize text-zinc-300">{domain}</span>
                <span className="font-mono text-zinc-400">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyPanel>Diff could not be computed for this pair of revisions.</EmptyPanel>
        )}
      </Panel>

      <Panel title="Merge gates (16 conditions)" full>
        {gateResult ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 px-4 py-4 sm:grid-cols-2">
            {gateResult.checks.map((c) => (
              <div key={c.gate} className="flex items-center gap-2 py-1 text-sm">
                <GateDot status={c.status} />
                <span className="text-zinc-500">#{c.gate}</span>
                <span className="text-zinc-300">{c.description}</span>
              </div>
            ))}
            <div className="col-span-full mt-2 border-t border-white/5 pt-3">
              <StatusBadge status={gateResult.eligible ? "pass" : "fail"} label={gateResult.eligible ? "Eligible to merge" : "Blocked"} />
            </div>
          </div>
        ) : (
          <EmptyPanel>Calculating merge eligibility…</EmptyPanel>
        )}
      </Panel>
    </div>
  );
}

function IntentTab({ changeIntent }: { changeIntent: ChangeIntent | null }) {
  if (!changeIntent) {
    return <EmptyPanel>This pull request has no linked change intent.</EmptyPanel>;
  }
  return (
    <Panel title={changeIntent.title}>
      <dl className="grid grid-cols-[140px_1fr] gap-y-3 px-4 py-4 text-sm">
        <dt className="text-zinc-500">Change type</dt>
        <dd>{changeIntent.changeType}</dd>
        <dt className="text-zinc-500">Status</dt>
        <dd>
          <StatusBadge status={changeIntent.status} />
        </dd>
        {changeIntent.requestText && (
          <>
            <dt className="text-zinc-500">Request</dt>
            <dd className="text-zinc-300">{changeIntent.requestText}</dd>
          </>
        )}
        <dt className="text-zinc-500">Preserve</dt>
        <dd>{changeIntent.preserve.join(", ") || <span className="text-zinc-600">none listed</span>}</dd>
        <dt className="text-zinc-500">Optimize</dt>
        <dd>{changeIntent.optimize.join(", ") || <span className="text-zinc-600">none listed</span>}</dd>
      </dl>
    </Panel>
  );
}

function DeltaTab({
  deltas,
  emptyLabel,
  visualNote,
}: {
  deltas: RevisionComparisonResult["semDiff"]["deltas"];
  emptyLabel: string;
  visualNote?: boolean;
}) {
  return (
    <Panel title={`${deltas.length} change${deltas.length === 1 ? "" : "s"}`}>
      {visualNote && (
        <p className="border-b border-white/5 px-4 py-2 text-xs text-zinc-500">
          Rendered visual diff requires kicad-cli in the serving environment; this view shows the
          structural diff, which is always available.
        </p>
      )}
      {deltas.length === 0 ? (
        <EmptyPanel>{emptyLabel}</EmptyPanel>
      ) : (
        <ul className="divide-y divide-white/5">
          {deltas.map((d, i) => (
            <li key={i} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
              <div>
                <span className="font-mono text-xs uppercase tracking-wide text-amber-400">{d.deltaType}</span>
                <p className="font-mono text-xs text-zinc-400">
                  {d.oldSemanticId ?? "—"} → {d.newSemanticId ?? "—"}
                </p>
              </div>
              {d.reviewDomains.length > 0 && (
                <span className="text-xs text-zinc-500">{d.reviewDomains.join(", ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function BomTab({
  deltas,
  diff,
}: {
  deltas: RevisionComparisonResult["semDiff"]["deltas"];
  diff: RevisionComparisonResult | null;
}) {
  const risks = diff?.semDiff.prSummary.bomRiskChanges ?? [];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <DeltaTab deltas={deltas} emptyLabel="No BOM changes." />
      <Panel title="BOM risk flags">
        {risks.length === 0 ? (
          <EmptyPanel>No elevated BOM risk detected.</EmptyPanel>
        ) : (
          <ul className="divide-y divide-white/5">
            {risks.map((r, i) => (
              <li key={i} className="px-4 py-2.5 text-sm text-amber-300">
                {r}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ConstraintsTab({ diff }: { diff: RevisionComparisonResult | null }) {
  if (!diff) return <EmptyPanel>Diff could not be computed.</EmptyPanel>;
  return (
    <Panel title="Constraint evaluation">
      {diff.hasBlockingConstraintViolation && (
        <div className="border-b border-red-500/20 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          At least one blocking constraint is violated -- this blocks merge gate #10.
        </div>
      )}
      {diff.constraintOutcomes.length === 0 ? (
        <EmptyPanel>No constraints are defined for the head revision.</EmptyPanel>
      ) : (
        <ul className="divide-y divide-white/5">
          {diff.constraintOutcomes.map((o) => {
            const constraint = diff.constraints.find((c) => c.id === o.constraintId);
            return (
              <li key={o.constraintId} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <div>
                  <p className="text-zinc-200">{constraint?.name ?? o.constraintId}</p>
                  <p className="text-xs text-zinc-500">{o.reason}</p>
                </div>
                <StatusBadge status={o.evaluation} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function ValidationTab({
  validations,
  gateResult,
}: {
  validations: ValidationResult[];
  gateResult: MergeGateResult | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel title="Validation records (head revision)">
        {validations.length === 0 ? (
          <EmptyPanel>No validation records yet.</EmptyPanel>
        ) : (
          <ul className="divide-y divide-white/5">
            {validations.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="font-mono text-xs uppercase tracking-wide text-zinc-400">{v.validationType}</span>
                <StatusBadge status={v.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Merge gate checks">
        {gateResult ? (
          <ul className="divide-y divide-white/5">
            {gateResult.checks.map((c) => (
              <li key={c.gate} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="text-zinc-300">
                  #{c.gate} {c.description}
                </span>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyPanel>Calculating…</EmptyPanel>
        )}
      </Panel>
    </div>
  );
}

function ReviewsTab({ pullRequest }: { pullRequest: EngineeringPullRequest }) {
  const events = [
    ...pullRequest.approvals.map((r) => ({ ...r, kind: "approve" as const })),
    ...pullRequest.changeRequests.map((r) => ({ ...r, kind: "request_changes" as const })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <Panel title="Review history">
      {events.length === 0 ? (
        <EmptyPanel>No reviews submitted yet.</EmptyPanel>
      ) : (
        <ul className="divide-y divide-white/5">
          {events.map((e, i) => (
            <li key={i} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="text-zinc-200">{e.reviewer}</p>
                {e.comment && <p className="mt-0.5 text-xs text-zinc-500">{e.comment}</p>}
                <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{e.createdAt}</p>
              </div>
              <StatusBadge status={e.kind === "approve" ? "approved" : "changes_requested"} label={e.kind === "approve" ? "Approved" : "Requested changes"} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Panel({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-zinc-900 ${full ? "lg:col-span-2" : ""}`}>
      <div className="border-b border-white/10 bg-zinc-800/50 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-zinc-500">{children}</p>;
}
