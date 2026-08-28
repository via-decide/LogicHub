import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import {
  ApiError,
  getPullRequest,
  getProject,
  getRevision,
  getDiff,
  listValidations,
  getChangeIntent,
} from "@/lib/logichub-api";
import { PrView } from "./PrView";

export default async function PullRequestDetailPage({
  params,
}: {
  params: Promise<{ pullRequestId: string }>;
}) {
  const { pullRequestId } = await params;

  const pullRequest = await getPullRequest(pullRequestId).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
  if (!pullRequest) notFound();

  const [project, baseRevision, headRevision, diff, headValidations, changeIntent] = await Promise.all([
    getProject(pullRequest.projectId).catch(() => null),
    getRevision(pullRequest.baseRevisionId).catch(() => null),
    getRevision(pullRequest.headRevisionId).catch(() => null),
    getDiff(pullRequest.baseRevisionId, pullRequest.headRevisionId).catch(() => null),
    listValidations(pullRequest.headRevisionId).catch(() => ({ items: [] })),
    pullRequest.changeIntentId ? getChangeIntent(pullRequest.changeIntentId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav
        crumbs={[
          { label: "Projects", href: "/projects" },
          ...(project
            ? [
                { label: project.name, href: `/projects/${project.id}` },
                { label: "Pull requests", href: `/projects/${project.id}/pull-requests` },
              ]
            : []),
          { label: `#${pullRequest.number}` },
        ]}
      />
      <PrView
        pullRequest={pullRequest}
        baseRevision={baseRevision}
        headRevision={headRevision}
        diff={diff}
        headValidations={headValidations.items}
        changeIntent={changeIntent}
      />
    </div>
  );
}
