/**
 * One shared status vocabulary for every "how sure are we" signal in the
 * app: ValidationStatus, ConstraintEvaluation, MergeGateStatus, and the
 * EpistemicState convention already used in
 * engineering/packages/{product-graph,generated-surfaces} (measured vs.
 * estimated vs. simulated vs. unknown). Never render evidence as more
 * certain than it is -- an unrecognized or missing status renders as
 * neutral/unknown, never as a silent pass.
 */
const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  pass: { label: "Pass", classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  verified: { label: "Verified", classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  measured: { label: "Measured", classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  approved: { label: "Approved", classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  merged: { label: "Merged", classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },

  warning: { label: "Warning", classes: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  estimated: { label: "Estimated", classes: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  calculated: { label: "Calculated", classes: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  changes_requested: { label: "Changes requested", classes: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  pending: { label: "Pending", classes: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  open: { label: "Open", classes: "bg-amber-500/15 text-amber-400 border-amber-500/30" },

  simulated: { label: "Simulated", classes: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  draft: { label: "Draft", classes: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  imported: { label: "Imported", classes: "bg-sky-500/15 text-sky-400 border-sky-500/30" },

  fail: { label: "Fail", classes: "bg-red-500/15 text-red-400 border-red-500/30" },
  violation: { label: "Violation", classes: "bg-red-500/15 text-red-400 border-red-500/30" },
  error: { label: "Error", classes: "bg-red-500/15 text-red-400 border-red-500/30" },
  rejected: { label: "Rejected", classes: "bg-red-500/15 text-red-400 border-red-500/30" },
  closed: { label: "Closed", classes: "bg-red-500/15 text-red-400 border-red-500/30" },
  failed: { label: "Failed", classes: "bg-red-500/15 text-red-400 border-red-500/30" },

  unknown: { label: "Unknown", classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  skipped: { label: "Skipped", classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  requires_validation: { label: "Requires validation", classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  active: { label: "Active", classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

const FALLBACK = { classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const style = STATUS_STYLES[status] ?? FALLBACK;
  const text = label ?? style.label ?? status.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${style.classes}`}
    >
      {text}
    </span>
  );
}

export function GateDot({ status }: { status: "pass" | "fail" | "pending" }) {
  const color = status === "pass" ? "bg-emerald-500" : status === "fail" ? "bg-red-500" : "bg-zinc-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />;
}
