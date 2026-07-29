import { resolve, isAbsolute } from 'node:path';
import { createLogicHubError } from '@logichub-engineering/shared';

const SHA_PATTERN = /^[0-9a-f]{4,40}$/;
const REF_ALLOWED_CHARS = /^[A-Za-z0-9._/-]+$/;

export function isSha(value: string): boolean {
  return SHA_PATTERN.test(value);
}

export function assertValidBranchName(name: string): void {
  if (
    name.length === 0 ||
    name.length > 255 ||
    !REF_ALLOWED_CHARS.test(name) ||
    name.startsWith('-') ||
    name.startsWith('/') ||
    name.endsWith('/') ||
    name.endsWith('.') ||
    name.endsWith('.lock') ||
    name.includes('..') ||
    name.includes('//') ||
    name.includes('@{')
  ) {
    throw createLogicHubError('LH_GIT_REF_NOT_FOUND',
      `Invalid branch name: '${name}'`,
      { diagnostics: { branchName: name } });
  }
}

export function assertValidRef(ref: string): void {
  if (ref === 'HEAD') return;
  if (isSha(ref)) return;
  assertValidBranchName(ref);
}

export function assertSafeRepositoryPath(repoPath: string): string {
  if (typeof repoPath !== 'string' || repoPath.length === 0) {
    throw createLogicHubError('LH_REPOSITORY_INVALID', 'Repository path must be a non-empty string');
  }
  if (repoPath.includes('\0')) {
    throw createLogicHubError('LH_REPOSITORY_INVALID', 'Repository path contains a null byte');
  }
  if (!isAbsolute(repoPath)) {
    throw createLogicHubError('LH_REPOSITORY_INVALID',
      `Repository path must be absolute: '${repoPath}'`,
      { diagnostics: { path: repoPath } });
  }
  const trimmed = repoPath.length > 1 ? repoPath.replace(/\/+$/, '') : repoPath;
  const resolved = resolve(trimmed);
  if (resolved !== trimmed) {
    throw createLogicHubError('LH_REPOSITORY_INVALID',
      `Repository path must be normalized (no '..' or '.' segments): '${repoPath}'`,
      { diagnostics: { path: repoPath, resolved } });
  }
  return resolved;
}
