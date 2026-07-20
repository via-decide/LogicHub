export function normalizeRuntimeError(error) {
  const message = error && error.message ? error.message : String(error || 'Runtime error');
  if (/401|token/i.test(message)) return { type: 'TOKEN_EXPIRED', message };
  if (/offline|network|fetch/i.test(message)) return { type: 'NETWORK_FAILURE', message };
  return { type: 'RUNTIME_ERROR', message };
}
