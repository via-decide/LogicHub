export function normalizePath(path: string): string {
  return path
    .split(/[\\/]/)
    .filter(s => s.length > 0 && s !== '.')
    .join('/');
}

export function isExcludedFromFingerprint(path: string): boolean {
  const normalized = normalizePath(path);
  if (normalized === 'fingerprint.json') return true;
  if (normalized === 'fingerprint.diagnostics.json') return true;
  if (normalized.startsWith('.git/')) return true;
  if (normalized.endsWith('.gitignore')) return false;
  return false;
}
