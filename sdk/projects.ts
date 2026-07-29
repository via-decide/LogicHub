import { logicHubClient } from './client';

export const projectsApi = {
  list: (workspaceId: string) => logicHubClient.request('/projects', { workspaceId }),
  get: (workspaceId: string, id: string) => logicHubClient.request('/projects/' + encodeURIComponent(id), { workspaceId }),
  create: (workspaceId: string, body: unknown) => logicHubClient.request('/projects', { method: 'POST', workspaceId, body: JSON.stringify(body) }),
  update: (workspaceId: string, id: string, body: unknown) => logicHubClient.request('/projects/' + encodeURIComponent(id), { method: 'PATCH', workspaceId, body: JSON.stringify(body) })
};
