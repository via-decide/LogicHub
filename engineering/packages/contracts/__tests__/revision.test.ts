import { describe, it, expect } from 'vitest';
import { RevisionSchema } from '../src/index.js';

const gitSha = 'a'.repeat(40);
const valid = {
  id: 'rev-1',
  projectId: 'proj-1',
  gitCommitSha: gitSha,
  branchName: 'main',
  parentRevisionIds: [],
  author: 'alice',
  message: 'Initial import',
  createdAt: '2026-01-15T10:00:00+00:00',
  toolchain: { kicad: '8.0.0' },
};

describe('RevisionSchema', () => {
  it('parses a valid revision', () => {
    const result = RevisionSchema.parse(valid);
    expect(result.status).toBe('draft');
    expect(result.schemaVersion).toBe('0.1.0');
    expect(result.gitCommitSha).toBe(gitSha);
  });

  it('rejects invalid git SHA', () => {
    expect(() => RevisionSchema.parse({ ...valid, gitCommitSha: 'short' })).toThrow();
    expect(() => RevisionSchema.parse({ ...valid, gitCommitSha: 'Z'.repeat(40) })).toThrow();
  });

  it('accepts all status values', () => {
    for (const s of ['draft', 'imported', 'validating', 'validated', 'review', 'merged', 'rejected', 'failed']) {
      expect(() => RevisionSchema.parse({ ...valid, status: s })).not.toThrow();
    }
  });

  it('accepts optional hash fields', () => {
    const hash = 'c'.repeat(64);
    const result = RevisionSchema.parse({
      ...valid,
      snapshotHash: hash,
      engineeringObjectSnapshotHash: hash,
    });
    expect(result.snapshotHash).toBe(hash);
  });

  it('rejects invalid hash format', () => {
    expect(() => RevisionSchema.parse({ ...valid, snapshotHash: 'bad' })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = RevisionSchema.parse(valid);
    expect(RevisionSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
