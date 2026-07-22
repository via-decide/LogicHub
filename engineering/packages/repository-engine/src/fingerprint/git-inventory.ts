import { GitExecutor } from '@logichub-engineering/git-adapter';
import { createLogicHubError } from '@logichub-engineering/shared';
import type { SourceFileEntry } from '../types.js';
import {
  classifyDomain, classifyFile, getLanguage, getParserProfile,
} from '../util/domain-classifier.js';
import { normalizePath, isExcludedFromFingerprint } from '../util/path-normalization.js';
import { sha256Hex } from '../util/hash.js';
import { sortByKey } from '../util/deterministic.js';

export async function resolveTreeSha(
  executor: GitExecutor, repoPath: string, commitRef: string,
): Promise<string> {
  const result = await executor.run(
    ['rev-parse', '--verify', `${commitRef}^{tree}`],
    repoPath,
  );
  if (result.exitCode !== 0) {
    throw createLogicHubError('LH_INTERNAL_ERROR',
      `Failed to resolve tree for ${commitRef}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

export async function resolveCommitSha(
  executor: GitExecutor, repoPath: string, commitRef: string,
): Promise<string> {
  const result = await executor.run(
    ['rev-parse', '--verify', `${commitRef}^{commit}`],
    repoPath,
  );
  if (result.exitCode !== 0) {
    throw createLogicHubError('LH_INTERNAL_ERROR',
      `Failed to resolve commit for ${commitRef}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

export async function detectObjectFormat(
  executor: GitExecutor, repoPath: string,
): Promise<string> {
  const result = await executor.run(
    ['rev-parse', '--show-object-format'],
    repoPath,
  );
  if (result.exitCode !== 0) return 'sha1';
  return result.stdout.trim() || 'sha1';
}

interface RawTreeEntry {
  mode: string;
  type: string;
  blobId: string;
  size: number;
  path: string;
}

export async function listTreeEntries(
  executor: GitExecutor, repoPath: string, treeSha: string,
): Promise<RawTreeEntry[]> {
  const result = await executor.run(
    ['ls-tree', '-r', '-z', '--long', treeSha],
    repoPath,
  );
  if (result.exitCode !== 0) {
    throw createLogicHubError('LH_INTERNAL_ERROR',
      `git ls-tree failed: ${result.stderr.trim()}`);
  }

  const entries: RawTreeEntry[] = [];
  const raw = result.stdout;
  const parts = raw.split('\0');
  for (const part of parts) {
    if (!part.trim()) continue;
    // format: "<mode> <type> <hash> <size>\t<path>"
    const tabIdx = part.indexOf('\t');
    if (tabIdx === -1) continue;
    const meta = part.slice(0, tabIdx);
    const path = part.slice(tabIdx + 1);
    const segments = meta.split(/\s+/);
    if (segments.length < 4) continue;
    entries.push({
      mode: segments[0],
      type: segments[1],
      blobId: segments[2],
      size: parseInt(segments[3], 10),
      path: normalizePath(path),
    });
  }
  return entries;
}

export async function readBlobContent(
  executor: GitExecutor, repoPath: string, blobId: string,
): Promise<Buffer> {
  const result = await executor.run(
    ['cat-file', 'blob', blobId],
    repoPath,
  );
  if (result.exitCode !== 0) {
    throw createLogicHubError('LH_INTERNAL_ERROR',
      `git cat-file blob failed for ${blobId}: ${result.stderr.trim()}`);
  }
  return Buffer.from(result.stdout, 'binary');
}

export async function readBlobString(
  executor: GitExecutor, repoPath: string, blobId: string,
): Promise<string> {
  const result = await executor.run(
    ['cat-file', 'blob', blobId],
    repoPath,
  );
  if (result.exitCode !== 0) {
    throw createLogicHubError('LH_INTERNAL_ERROR',
      `git cat-file blob failed for ${blobId}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

export async function buildSourceInventory(
  executor: GitExecutor, repoPath: string, treeSha: string,
): Promise<SourceFileEntry[]> {
  const raw = await listTreeEntries(executor, repoPath, treeSha);
  const entries: SourceFileEntry[] = [];

  for (const entry of raw) {
    if (entry.type !== 'blob') continue;
    if (isExcludedFromFingerprint(entry.path)) continue;

    const domainClass = classifyDomain(entry.path);
    const language = getLanguage(entry.path);
    const classification = classifyFile(entry.path);
    const parserProfile = getParserProfile(entry.path, language);

    const contentHash = sha256Hex(Buffer.from(entry.blobId, 'hex').length > 0
      ? entry.blobId
      : entry.blobId);

    entries.push({
      path: entry.path,
      blobId: entry.blobId,
      byteSize: entry.size,
      mode: entry.mode,
      domainClass,
      language,
      classification,
      parserProfile,
      parseStatus: 'skipped',
      contentHash: '',
    });
  }

  return sortByKey(entries, e => e.path);
}

export async function computeContentHashes(
  executor: GitExecutor,
  repoPath: string,
  entries: SourceFileEntry[],
): Promise<SourceFileEntry[]> {
  const updated: SourceFileEntry[] = [];
  for (const entry of entries) {
    const content = await readBlobString(executor, repoPath, entry.blobId);
    const contentHash = sha256Hex(content);
    updated.push({ ...entry, contentHash });
  }
  return updated;
}
