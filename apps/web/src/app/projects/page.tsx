import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { StatusBadge } from "@/lib/status-badge";
import {
  listProjects,
  listRevisions,
  listPullRequests,
  listValidations,
  type Project,
} from "@/lib/logichub-api";

async function projectSummary(project: Project) {
  const revisions = await listRevisions(project.id, { limit: 1 }).catch(() => ({ items: [] as const, total: 0 }));
  const latest = revisions.items[0];
  const [validations, pullRequests] = await Promise.all([
    latest ? listValidations(latest.id).catch(() => ({ items: [] as const })) : Promise.resolve({ items: [] as const }),
    listPullRequests(project.id, { limit: 100 }).catch(() => ({ items: [] as const })),
  ]);
  const worstValidation = validations.items.reduce<string | null>((worst, v) => {
    const rank = ["pass", "warning", "skipped", "unknown", "fail", "error"];
    if (!worst) return v.status;
    return rank.indexOf(v.status) > rank.indexOf(worst) ? v.status : worst;
  }, null);
  const openPrCount = pullRequests.items.filter(
    (pr) => pr.status !== "merged" && pr.status !== "closed" && pr.status !== "rejected"
  ).length;

  return { project, latest, validationStatus: worstValidation, openPrCount };
}

export default async function ProjectsPage() {
  const page = await listProjects({ limit: 50 });
  const summaries = await Promise.all(page.items.map(projectSummary));

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav crumbs={[{ label: "Projects" }]} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-amber-400">Engineering platform</p>
            <h1 className="text-3xl font-bold">Projects</h1>
          </div>
        </div>

        {summaries.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-10 text-center text-zinc-400">
            No projects yet. Import one via <code className="text-amber-400">POST /projects/import</code>.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/10 bg-zinc-800/50 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Visibility</th>
                  <th className="px-4 py-3 font-medium">Default branch</th>
                  <th className="px-4 py-3 font-medium">Latest revision</th>
                  <th className="px-4 py-3 font-medium">Validation</th>
                  <th className="px-4 py-3 font-medium">Open PRs</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map(({ project, latest, validationStatus, openPrCount }) => (
                  <tr key={project.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${project.id}`} className="font-semibold text-white hover:text-amber-400">
                        {project.name}
                      </Link>
                      <div className="font-mono text-xs text-zinc-500">{project.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{project.visibility}</td>
                    <td className="px-4 py-3 font-mono text-zinc-300">{project.defaultBranch}</td>
                    <td className="px-4 py-3">
                      {latest ? (
                        <Link href={`/revisions/${latest.id}`} className="font-mono text-xs text-zinc-300 hover:text-amber-400">
                          {latest.gitCommitSha.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-zinc-600">none</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {validationStatus ? <StatusBadge status={validationStatus} /> : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{openPrCount}</td>
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
