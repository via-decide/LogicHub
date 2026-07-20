import { logicHubClient } from './client';

export const knowledgeApi = {
  list: (workspaceId: string) => logicHubClient.request('/knowledge', { workspaceId }),
  get: (workspaceId: string, id: string) => logicHubClient.request('/knowledge/' + encodeURIComponent(id), { workspaceId }),
  create: (workspaceId: string, body: unknown) => logicHubClient.request('/knowledge', { method: 'POST', workspaceId, body: JSON.stringify(body) }),
  update: (workspaceId: string, id: string, body: unknown) => logicHubClient.request('/knowledge/' + encodeURIComponent(id), { method: 'PATCH', workspaceId, body: JSON.stringify(body) })
};
