import { Fragment } from "react";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { StatusBadge } from "@/lib/status-badge";
import { ApiError, getProject, getRevision, listValidations } from "@/lib/logichub-api";

export default async function RevisionDetailPage({
  params,
}: {
  params: Promise<{ revisionId: string }>;
}) {
  const { revisionId } = await params;

  const revision = await getRevision(revisionId).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
  if (!revision) notFound();

  const [project, validations] = await Promise.all([
    getProject(revision.projectId).catch(() => null),
    listValidations(revisionId),
  ]);

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav
        crumbs={[
          { label: "Projects", href: "/projects" },
          ...(project ? [{ label: project.name, href: `/projects/${project.id}` }] : []),
          { label: revision.gitCommitSha.slice(0, 8) },
        ]}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-amber-400">{revision.branchName}</p>
            <h1 className="font-mono text-2xl font-bold">{revision.gitCommitSha}</h1>
          </div>
          <StatusBadge status={revision.status} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Overview">
            <dl className="grid grid-cols-[120px_1fr] gap-y-3 px-4 py-4 text-sm">
              <dt className="text-zinc-500">Author</dt>
              <dd>{revision.author}</dd>
              <dt className="text-zinc-500">Message</dt>
              <dd>{revision.message || <span className="text-zinc-600">(no message)</span>}</dd>
              <dt className="text-zinc-500">Created</dt>
              <dd className="font-mono text-xs">{revision.createdAt}</dd>
              <dt className="text-zinc-500">Toolchain</dt>
              <dd>
                {Object.keys(revision.toolchain ?? {}).length === 0 ? (
                  <span className="text-zinc-600">not recorded</span>
                ) : (
                  <ul className="space-y-1 font-mono text-xs">
                    {Object.entries(revision.toolchain).map(([k, v]) => (
                      <li key={k}>
                        {k}: {v}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </dl>
          </Section>

          <Section title="Snapshot hashes">
            <dl className="grid grid-cols-[160px_1fr] gap-y-3 px-4 py-4 font-mono text-xs">
              {(
                [
                  ["Objects", revision.engineeringObjectSnapshotHash],
                  ["Constraints", revision.constraintSnapshotHash],
                  ["Decisions", revision.decisionSnapshotHash],
                  ["BOM", revision.bomSnapshotHash],
                  ["Artifacts", revision.artifactManifestHash],
                ] as const
              ).map(([label, hash]) => (
                <Fragment key={label}>
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="truncate text-zinc-300">{hash ?? <span className="text-zinc-600">unset</span>}</dd>
                </Fragment>
              ))}
            </dl>
          </Section>

          <Section title="Validation records" full>
            {validations.items.length === 0 ? (
              <Empty>No validation records for this revision yet.</Empty>
            ) : (
              <ul className="divide-y divide-white/5">
                {validations.items.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <div>
                      <span className="font-mono text-xs uppercase tracking-wide text-zinc-400">{v.validationType}</span>
                      <p className="text-zinc-300">{v.validator}</p>
                      {v.diagnostics.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
                          {v.diagnostics.slice(0, 3).map((d, i) => (
                            <li key={i}>
                              [{d.severity}] {d.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <StatusBadge status={v.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Engineering objects / BOM">
            <Empty>Not yet exposed by the API surface -- view via the diff on an engineering pull request.</Empty>
          </Section>

          <Section title="Constraints / Decisions / Artifacts">
            <Empty>Not yet exposed by the API surface (master spec section 12 does not list these as revision-scoped list endpoints).</Empty>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-zinc-900 ${full ? "lg:col-span-2" : ""}`}>
      <div className="border-b border-white/10 bg-zinc-800/50 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-zinc-500">{children}</p>;
}
