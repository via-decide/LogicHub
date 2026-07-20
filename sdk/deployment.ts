import { logicHubClient } from './client';

export const deploymentApi = {
  list: (workspaceId: string) => logicHubClient.request('/deployment', { workspaceId }),
  get: (workspaceId: string, id: string) => logicHubClient.request('/deployment/' + encodeURIComponent(id), { workspaceId }),
  create: (workspaceId: string, body: unknown) => logicHubClient.request('/deployment', { method: 'POST', workspaceId, body: JSON.stringify(body) }),
  update: (workspaceId: string, id: string, body: unknown) => logicHubClient.request('/deployment/' + encodeURIComponent(id), { method: 'PATCH', workspaceId, body: JSON.stringify(body) })
};
