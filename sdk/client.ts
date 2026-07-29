export type LogicHubRequestOptions = RequestInit & { token?: string; workspaceId?: string };

export class LogicHubClient {
  baseUrl: string;
  tokenProvider: () => string | null;

  constructor(options: { baseUrl?: string; tokenProvider?: () => string | null } = {}) {
    this.baseUrl = options.baseUrl || 'https://daxini.space/api';
    this.tokenProvider = options.tokenProvider || (() => null);
  }

  async request<T>(path: string, options: LogicHubRequestOptions = {}): Promise<T> {
    const token = options.token || this.tokenProvider();
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.workspaceId) headers.set('X-Workspace-Id', options.workspaceId);

    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) throw new Error((data && (data.error || data.message)) || `DAXINI request failed: ${response.status}`);
    return data as T;
  }

  stream(path: string, options: { token?: string; workspaceId?: string; onMessage?: (event: MessageEvent) => void } = {}) {
    const url = new URL(`${this.baseUrl.replace(/^http/, 'ws')}${path}`);
    const token = options.token || this.tokenProvider();
    if (token) url.searchParams.set('token', token);
    if (options.workspaceId) url.searchParams.set('workspaceId', options.workspaceId);
    const socket = new WebSocket(url);
    if (options.onMessage) socket.addEventListener('message', options.onMessage);
    return socket;
  }
}

export const logicHubClient = new LogicHubClient({
  baseUrl: (globalThis as any).DAXINI_API_URL || 'https://daxini.space/api',
  tokenProvider: () => (globalThis as any).LogicHubAuth?.getToken?.() || null
});
