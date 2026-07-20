import { logicHubClient } from './client';

export const jobsApi = {
  list: (workspaceId: string) => logicHubClient.request('/jobs', { workspaceId }),
  get: (workspaceId: string, id: string) => logicHubClient.request('/jobs/' + encodeURIComponent(id), { workspaceId }),
  create: (workspaceId: string, body: unknown) => logicHubClient.request('/jobs', { method: 'POST', workspaceId, body: JSON.stringify(body) }),
  update: (workspaceId: string, id: string, body: unknown) => logicHubClient.request('/jobs/' + encodeURIComponent(id), { method: 'PATCH', workspaceId, body: JSON.stringify(body) })
};
