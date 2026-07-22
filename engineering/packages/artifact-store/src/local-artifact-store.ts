import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogicHubError } from '@logichub-engineering/shared';
import type { ArtifactStore, ArtifactMetadata, PutResult } from './interfaces.js';

export class LocalArtifactStore implements ArtifactStore {
  constructor(private readonly rootDir: string) {}

  private contentPath(sha256: string): string {
    return join(this.rootDir, sha256.slice(0, 2), sha256);
  }

  private metadataPath(sha256: string): string {
    return this.contentPath(sha256) + '.meta.json';
  }

  private computeHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  async put(content: Buffer, meta: Omit<ArtifactMetadata, 'sha256' | 'byteSize'>): Promise<PutResult> {
    const sha256 = this.computeHash(content);
    const contentFile = this.contentPath(sha256);

    let alreadyExisted = false;
    try {
      await access(contentFile);
      const existing = await readFile(contentFile);
      if (!existing.equals(content)) {
        throw createLogicHubError('LH_ARTIFACT_HASH_MISMATCH',
          `Existing content at ${sha256} differs from new content`,
          { entityIds: { sha256 } });
      }
      alreadyExisted = true;
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'LH_ARTIFACT_HASH_MISMATCH') throw err;
      if (!alreadyExisted) {
        const dir = join(this.rootDir, sha256.slice(0, 2));
        await mkdir(dir, { recursive: true });
        await writeFile(contentFile, content);
      }
    }

    const fullMeta: ArtifactMetadata = {
      sha256,
      mediaType: meta.mediaType,
      byteSize: content.length,
      createdAt: meta.createdAt,
      filename: meta.filename,
    };
    await writeFile(this.metadataPath(sha256), JSON.stringify(fullMeta, null, 2));

    return { sha256, byteSize: content.length, alreadyExisted };
  }

  async get(sha256: string): Promise<Buffer | null> {
    try {
      return await readFile(this.contentPath(sha256));
    } catch {
      return null;
    }
  }

  async getMetadata(sha256: string): Promise<ArtifactMetadata | null> {
    try {
      const raw = await readFile(this.metadataPath(sha256), 'utf-8');
      return JSON.parse(raw) as ArtifactMetadata;
    } catch {
      return null;
    }
  }

  async verify(sha256: string): Promise<boolean> {
    const content = await this.get(sha256);
    if (!content) return false;

    const actual = this.computeHash(content);
    if (actual !== sha256) {
      throw createLogicHubError('LH_ARTIFACT_HASH_MISMATCH',
        `Stored content hash ${actual} does not match expected ${sha256}`,
        { entityIds: { expectedSha256: sha256, actualSha256: actual } });
    }
    return true;
  }

  async exists(sha256: string): Promise<boolean> {
    try {
      await access(this.contentPath(sha256));
      return true;
    } catch {
      return false;
    }
  }
}
