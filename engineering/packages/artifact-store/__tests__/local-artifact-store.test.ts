import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { LocalArtifactStore } from '../src/local-artifact-store.js';

function computeSha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('LocalArtifactStore', () => {
  let rootDir: string;
  let store: LocalArtifactStore;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'artifact-store-test-'));
    store = new LocalArtifactStore(rootDir);
  });

  it('stores and retrieves content', async () => {
    const content = Buffer.from('hello world');
    const result = await store.put(content, {
      mediaType: 'text/plain',
      createdAt: '2025-01-15T10:00:00.000Z',
      filename: 'test.txt',
    });
    expect(result.sha256).toBe(computeSha256(content));
    expect(result.byteSize).toBe(content.length);
    expect(result.alreadyExisted).toBe(false);

    const retrieved = await store.get(result.sha256);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.equals(content)).toBe(true);
  });

  it('deduplicates identical content', async () => {
    const content = Buffer.from('duplicate content');
    const meta = { mediaType: 'text/plain', createdAt: '2025-01-15T10:00:00.000Z', filename: 'test.txt' };
    const first = await store.put(content, meta);
    const second = await store.put(content, meta);
    expect(first.sha256).toBe(second.sha256);
    expect(second.alreadyExisted).toBe(true);
  });

  it('returns null for non-existent hash', async () => {
    const result = await store.get('0'.repeat(64));
    expect(result).toBeNull();
  });

  it('stores metadata sidecar', async () => {
    const content = Buffer.from('with metadata');
    const result = await store.put(content, {
      mediaType: 'application/pdf',
      createdAt: '2025-01-15T10:00:00.000Z',
      filename: 'doc.pdf',
    });

    const metadata = await store.getMetadata(result.sha256);
    expect(metadata).not.toBeNull();
    expect(metadata!.sha256).toBe(result.sha256);
    expect(metadata!.mediaType).toBe('application/pdf');
    expect(metadata!.byteSize).toBe(content.length);
    expect(metadata!.filename).toBe('doc.pdf');
  });

  it('returns null metadata for non-existent hash', async () => {
    expect(await store.getMetadata('0'.repeat(64))).toBeNull();
  });

  it('uses prefix sharding in storage layout', async () => {
    const content = Buffer.from('sharded');
    const result = await store.put(content, {
      mediaType: 'text/plain',
      createdAt: '2025-01-15T10:00:00.000Z',
    });
    const prefix = result.sha256.slice(0, 2);
    const contentPath = join(rootDir, prefix, result.sha256);
    expect(readFileSync(contentPath).equals(content)).toBe(true);
  });

  it('verifies valid content', async () => {
    const content = Buffer.from('valid content');
    const result = await store.put(content, {
      mediaType: 'text/plain',
      createdAt: '2025-01-15T10:00:00.000Z',
    });
    const valid = await store.verify(result.sha256);
    expect(valid).toBe(true);
  });

  it('returns false for verify on non-existent hash', async () => {
    const valid = await store.verify('0'.repeat(64));
    expect(valid).toBe(false);
  });

  it('checks existence', async () => {
    const content = Buffer.from('exists test');
    const result = await store.put(content, {
      mediaType: 'text/plain',
      createdAt: '2025-01-15T10:00:00.000Z',
    });
    expect(await store.exists(result.sha256)).toBe(true);
    expect(await store.exists('0'.repeat(64))).toBe(false);
  });
});
