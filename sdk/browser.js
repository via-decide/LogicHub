(function (global) {
  const DEFAULT_BASE_URL = 'https://daxini.space/api';
  function getBaseUrl() { return global.DAXINI_API_URL || DEFAULT_BASE_URL; }
  function getToken() { return global.LogicHubAuth?.getToken?.() || global.localStorage?.getItem('daxini_jwt') || ''; }
  function getWorkspaceId() { return global.LogicHubWorkspace?.id || global.localStorage?.getItem('daxini_workspace_id') || 'default'; }
  async function request(path, options) {
    const opts = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const token = opts.token || getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    headers['X-Workspace-Id'] = opts.workspaceId || getWorkspaceId();
    const response = await fetch(`${getBaseUrl()}${path}`, Object.assign({}, opts, { headers }));
    return response;
  }
  async function createJob(payload) {
    const response = await request('/jobs', { method: 'POST', body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || `DAXINI job failed with status ${response.status}`);
    return data;
  }
  function streamJob(jobId, onMessage) {
    const url = new URL(`${getBaseUrl().replace(/^http/, 'ws')}/jobs/${encodeURIComponent(jobId)}/stream`);
    url.searchParams.set('workspaceId', getWorkspaceId());
    const token = getToken();
    if (token) url.searchParams.set('token', token);
    const socket = new WebSocket(url);
    if (onMessage) socket.addEventListener('message', onMessage);
    return socket;
  }
  global.LogicHubSDK = { request, createJob, streamJob, getWorkspaceId };
})(window);
