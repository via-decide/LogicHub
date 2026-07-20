import { logicHubClient } from './client';

export const settingsApi = {
  list: (workspaceId: string) => logicHubClient.request('/settings', { workspaceId }),
  get: (workspaceId: string, id: string) => logicHubClient.request('/settings/' + encodeURIComponent(id), { workspaceId }),
  create: (workspaceId: string, body: unknown) => logicHubClient.request('/settings', { method: 'POST', workspaceId, body: JSON.stringify(body) }),
  update: (workspaceId: string, id: string, body: unknown) => logicHubClient.request('/settings/' + encodeURIComponent(id), { method: 'PATCH', workspaceId, body: JSON.stringify(body) })
};
