import { logicHubClient } from './client';

export const authApi = {
  list: (workspaceId: string) => logicHubClient.request('/auth', { workspaceId }),
  get: (workspaceId: string, id: string) => logicHubClient.request('/auth/' + encodeURIComponent(id), { workspaceId }),
  create: (workspaceId: string, body: unknown) => logicHubClient.request('/auth', { method: 'POST', workspaceId, body: JSON.stringify(body) }),
  update: (workspaceId: string, id: string, body: unknown) => logicHubClient.request('/auth/' + encodeURIComponent(id), { method: 'PATCH', workspaceId, body: JSON.stringify(body) })
};
