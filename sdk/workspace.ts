import { logicHubClient } from './client';

export const workspaceApi = {
  list: (workspaceId: string) => logicHubClient.request('/workspace', { workspaceId }),
  get: (workspaceId: string, id: string) => logicHubClient.request('/workspace/' + encodeURIComponent(id), { workspaceId }),
  create: (workspaceId: string, body: unknown) => logicHubClient.request('/workspace', { method: 'POST', workspaceId, body: JSON.stringify(body) }),
  update: (workspaceId: string, id: string, body: unknown) => logicHubClient.request('/workspace/' + encodeURIComponent(id), { method: 'PATCH', workspaceId, body: JSON.stringify(body) })
};
