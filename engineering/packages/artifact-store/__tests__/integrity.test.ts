import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { LocalArtifactStore } from '../src/local-artifact-store.js';

function computeSha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('Artifact Store Integrity', () => {
  let rootDir: string;
  let store: LocalArtifactStore;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'artifact-integrity-test-'));
    store = new LocalArtifactStore(rootDir);
  });

  it('detects tampered content on verify', async () => {
    const content = Buffer.from('original content');
    const result = await store.put(content, {
      mediaType: 'text/plain',
      createdAt: '2025-01-15T10:00:00.000Z',
    });

    const prefix = result.sha256.slice(0, 2);
    const contentPath = join(rootDir, prefix, result.sha256);
    writeFileSync(contentPath, 'tampered content');

    await expect(store.verify(result.sha256)).rejects.toThrow(/does not match/i);
  });

  it('detects collision on put with different content', async () => {
    const content1 = Buffer.from('content A');
    const result = await store.put(content1, {
      mediaType: 'text/plain',
      createdAt: '2025-01-15T10:00:00.000Z',
    });

    const prefix = result.sha256.slice(0, 2);
    const contentPath = join(rootDir, prefix, result.sha256);
    writeFileSync(contentPath, 'different content');

    await expect(
      store.put(content1, {
        mediaType: 'text/plain',
        createdAt: '2025-01-15T10:00:00.000Z',
      }),
    ).rejects.toThrow(/differs from/i);
  });

  it('verify returns false for missing hash', async () => {
    const valid = await store.verify(computeSha256(Buffer.from('nonexistent')));
    expect(valid).toBe(false);
  });

  it('stores binary content correctly', async () => {
    const binaryContent = Buffer.from([0x00, 0xff, 0x80, 0x42, 0xde, 0xad]);
    const result = await store.put(binaryContent, {
      mediaType: 'application/octet-stream',
      createdAt: '2025-01-15T10:00:00.000Z',
      filename: 'data.bin',
    });

    const retrieved = await store.get(result.sha256);
    expect(retrieved!.equals(binaryContent)).toBe(true);

    const valid = await store.verify(result.sha256);
    expect(valid).toBe(true);
  });
});
