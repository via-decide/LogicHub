export function useWorkspaceSnapshot() {
  return { workspaceId: (globalThis as any).LogicHubSDK?.getWorkspaceId?.() || 'default' };
}
