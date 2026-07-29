import { logicHubClient } from './client';

export type RuntimeJobRequest = { workspaceId: string; projectId?: string; type: string; input: unknown };
export type RuntimeJob = { id: string; status: string; result?: unknown };

export function createRuntimeJob(payload: RuntimeJobRequest) {
  return logicHubClient.request<RuntimeJob>('/jobs', {
    method: 'POST',
    workspaceId: payload.workspaceId,
    body: JSON.stringify(payload)
  });
}

export function connectRuntimeStream(jobId: string, handlers: { onMessage?: (event: MessageEvent) => void; workspaceId?: string }) {
  return logicHubClient.stream(`/jobs/${encodeURIComponent(jobId)}/stream`, handlers);
}
