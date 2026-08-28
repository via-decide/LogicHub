import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { StatusBadge } from "@/lib/status-badge";
import { ApiError, getProject, listPullRequests } from "@/lib/logichub-api";

export default async function PullRequestListPage({
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

  const pullRequests = await listPullRequests(projectId, { limit: 100 });

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav
        crumbs={[
          { label: "Projects", href: "/projects" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: "Pull requests" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-8 text-3xl font-bold">Pull requests</h1>

        {pullRequests.items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-10 text-center text-zinc-400">
            No pull requests yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-white/10 bg-zinc-800/50 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Base → Head</th>
                  <th className="px-4 py-3 font-medium">Author</th>
                  <th className="px-4 py-3 font-medium">Review state</th>
                  <th className="px-4 py-3 font-medium">Validation</th>
                  <th className="px-4 py-3 font-medium">Merge eligibility</th>
                </tr>
              </thead>
              <tbody>
                {pullRequests.items.map((pr) => (
                  <tr key={pr.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3 font-mono text-zinc-400">{pr.number}</td>
                    <td className="px-4 py-3">
                      <Link href={`/pull-requests/${pr.id}`} className="font-semibold hover:text-amber-400">
                        {pr.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {pr.baseBranch} → {pr.headBranch}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{pr.author}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={pr.status} />
                    </td>
                    <td className="px-4 py-3">
                      {pr.validationSummary ? (
                        <span className="text-zinc-300">
                          {pr.validationSummary.passed}/{pr.validationSummary.total} passed
                        </span>
                      ) : (
                        <span className="text-zinc-600">not yet calculated</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {pr.mergeEligibility ? (
                        <StatusBadge status={pr.mergeEligibility.eligible ? "pass" : "fail"} label={pr.mergeEligibility.eligible ? "Eligible" : "Blocked"} />
                      ) : (
                        <span className="text-zinc-600">not yet calculated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
