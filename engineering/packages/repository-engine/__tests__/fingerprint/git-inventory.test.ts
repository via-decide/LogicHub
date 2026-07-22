import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rmSync } from 'node:fs';
import { GitExecutor } from '@logichub-engineering/git-adapter';
import {
  resolveTreeSha, resolveCommitSha, listTreeEntries,
  readBlobContent, readBlobString, buildSourceInventory,
  computeContentHashes,
} from '../../src/fingerprint/git-inventory.js';
import { createFixtureRepo, commitFile, commitFiles, headSha, treeSha, git } from '../helpers.js';
import { sha256Hex } from '../../src/util/hash.js';

describe('git-inventory', () => {
  let repoDir: string;
  let executor: GitExecutor;
  let commitSha: string;
  let treeId: string;

  beforeAll(() => {
    repoDir = createFixtureRepo();
    commitFile(repoDir, 'firmware/main.ts', 'export function setup() {}\n', 'add firmware');
    commitFile(repoDir, 'firmware/sensor.ts', 'export function read() { return 42; }\n', 'add sensor');
    commitSha = commitFile(repoDir, 'firmware/config.ts', 'export const MAX_VOLTAGE = 5.0;\n', 'add config');
    treeId = treeSha(repoDir, commitSha);
    executor = new GitExecutor();
  });

  afterAll(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  describe('resolveCommitSha', () => {
    it('resolves HEAD to a sha', async () => {
      const sha = await resolveCommitSha(executor, repoDir, 'HEAD');
      expect(sha).toBe(commitSha);
    });

    it('resolves full sha', async () => {
      const sha = await resolveCommitSha(executor, repoDir, commitSha);
      expect(sha).toBe(commitSha);
    });
  });

  describe('resolveTreeSha', () => {
    it('resolves commit to tree sha', async () => {
      const tree = await resolveTreeSha(executor, repoDir, commitSha);
      expect(tree).toBe(treeId);
      expect(tree).toHaveLength(40);
    });
  });

  describe('listTreeEntries', () => {
    it('lists all files in tree', async () => {
      const entries = await listTreeEntries(executor, repoDir, treeId);
      const paths = entries.map(e => e.path).sort();
      expect(paths).toContain('README.md');
      expect(paths).toContain('firmware/main.ts');
      expect(paths).toContain('firmware/sensor.ts');
      expect(paths).toContain('firmware/config.ts');
    });

    it('returns correct blob ids and sizes', async () => {
      const entries = await listTreeEntries(executor, repoDir, treeId);
      for (const entry of entries) {
        expect(entry.blobId).toMatch(/^[0-9a-f]{40}$/);
        expect(entry.size).toBeGreaterThan(0);
        expect(entry.mode).toBe('100644');
      }
    });
  });

  describe('readBlobContent / readBlobString', () => {
    it('reads blob content as buffer', async () => {
      const entries = await listTreeEntries(executor, repoDir, treeId);
      const mainEntry = entries.find(e => e.path === 'firmware/main.ts')!;
      const content = await readBlobContent(executor, repoDir, mainEntry.blobId);
      expect(content).toBeInstanceOf(Buffer);
      expect(content.toString('utf-8')).toBe('export function setup() {}\n');
    });

    it('reads blob content as string', async () => {
      const entries = await listTreeEntries(executor, repoDir, treeId);
      const configEntry = entries.find(e => e.path === 'firmware/config.ts')!;
      const content = await readBlobString(executor, repoDir, configEntry.blobId);
      expect(content).toBe('export const MAX_VOLTAGE = 5.0;\n');
    });
  });

  describe('buildSourceInventory', () => {
    it('builds inventory with domain classification', async () => {
      const inventory = await buildSourceInventory(executor, repoDir, treeId);
      expect(inventory.length).toBeGreaterThanOrEqual(4);

      const tsFiles = inventory.filter(e => e.language === 'typescript');
      expect(tsFiles.length).toBe(3);
      for (const f of tsFiles) {
        expect(f.domainClass).toMatch(/software|firmware/);
      }
    });

    it('returns deterministic sorted order', async () => {
      const inv1 = await buildSourceInventory(executor, repoDir, treeId);
      const inv2 = await buildSourceInventory(executor, repoDir, treeId);
      expect(inv1.map(e => e.path)).toEqual(inv2.map(e => e.path));
    });
  });

  describe('computeContentHashes', () => {
    it('computes SHA-256 content hashes', async () => {
      const inventory = await buildSourceInventory(executor, repoDir, treeId);
      const hashed = await computeContentHashes(executor, repoDir, inventory);

      for (const entry of hashed) {
        expect(entry.contentHash).toMatch(/^[0-9a-f]{64}$/);
      }

      const configEntry = hashed.find(e => e.path === 'firmware/config.ts')!;
      const expectedHash = sha256Hex(Buffer.from('export const MAX_VOLTAGE = 5.0;\n', 'utf-8'));
      expect(configEntry.contentHash).toBe(expectedHash);
    });
  });
});
