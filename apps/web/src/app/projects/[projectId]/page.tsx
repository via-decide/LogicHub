import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { StatusBadge } from "@/lib/status-badge";
import { ApiError, getProject, listBranches, listRevisions, listPullRequests } from "@/lib/logichub-api";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
  if (!project) notFound();

  const [branches, revisions, pullRequests] = await Promise.all([
    listBranches(projectId).catch(() => []),
    listRevisions(projectId, { limit: 20 }),
    listPullRequests(projectId, { limit: 20 }),
  ]);

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav crumbs={[{ label: "Projects", href: "/projects" }, { label: project.name }]} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-amber-400">{project.slug}</p>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {project.description && <p className="mt-2 max-w-xl text-zinc-400">{project.description}</p>}
          </div>
          <StatusBadge status={project.status} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Branches">
            {branches.length === 0 ? (
              <Empty>No branches found.</Empty>
            ) : (
              <ul className="divide-y divide-white/5">
                {branches.map((b) => (
                  <li key={b.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-mono">{b.name}</span>
                    <span className="font-mono text-xs text-zinc-500">{b.headSha.slice(0, 8)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Pull requests" action={<Link href={`/projects/${project.id}/pull-requests`} className="text-xs text-amber-400 hover:underline">View all →</Link>}>
            {pullRequests.items.length === 0 ? (
              <Empty>No pull requests yet.</Empty>
            ) : (
              <ul className="divide-y divide-white/5">
                {pullRequests.items.slice(0, 8).map((pr) => (
                  <li key={pr.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <Link href={`/pull-requests/${pr.id}`} className="truncate hover:text-amber-400">
                      #{pr.number} {pr.title}
                    </Link>
                    <StatusBadge status={pr.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Revisions" full>
            {revisions.items.length === 0 ? (
              <Empty>No revisions imported yet.</Empty>
            ) : (
              <ul className="divide-y divide-white/5">
                {revisions.items.map((rev) => (
                  <li key={rev.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <Link href={`/revisions/${rev.id}`} className="flex items-center gap-3 hover:text-amber-400">
                      <span className="font-mono text-xs text-zinc-500">{rev.gitCommitSha.slice(0, 8)}</span>
                      <span className="font-mono text-xs text-zinc-400">{rev.branchName}</span>
                      <span className="truncate text-zinc-300">{rev.message || "(no message)"}</span>
                    </Link>
                    <StatusBadge status={rev.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Constraints" full>
            <Empty>
              Not yet exposed by the API surface (master spec section 12 does not list a constraints-list
              endpoint) -- see revision detail for constraint outcomes on a specific diff.
            </Empty>
          </Section>

          <Section title="Recent decisions" full>
            <Empty>
              Not yet exposed by the API surface (master spec section 12 does not list a decisions-list
              endpoint).
            </Empty>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
  action,
  full,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  full?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-zinc-900 ${full ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center justify-between border-b border-white/10 bg-zinc-800/50 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-zinc-500">{children}</p>;
}
