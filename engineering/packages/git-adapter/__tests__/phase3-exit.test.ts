import { describe, it, expect } from 'vitest';
import {
  createDatabase, runMigrations,
  SqliteProjectRepository, SqliteRevisionRepository,
} from '@logichub-engineering/persistence';
import { GitRepository } from '../src/git-repository.js';
import { createFixtureRepo, commitFile, headSha } from './helpers.js';

const NOW = '2025-01-15T10:00:00.000Z';

describe('Phase 3 exit condition: two Git revisions registered and compared', () => {
  it('registers two revisions from real git commits and compares them', async () => {
    // real git repository with two commits
    const repoDir = createFixtureRepo();
    const firstSha = headSha(repoDir);
    const secondSha = commitFile(repoDir, 'power.kicad_sch', '(schematic)', 'add power schematic');

    const gitRepo = await GitRepository.open(repoDir);

    // register the repository as a project + two revisions in persistence
    const db = createDatabase({ path: ':memory:' });
    runMigrations(db);
    const projects = new SqliteProjectRepository(db);
    const revisions = new SqliteRevisionRepository(db);

    await projects.create({
      id: 'proj-1',
      schemaVersion: '0.1.0',
      slug: 'fixture-board',
      name: 'Fixture Board',
      visibility: 'private',
      repository: { provider: 'local', localPath: gitRepo.path, defaultBranch: 'main' },
      defaultBranch: 'main',
      createdBy: 'user-1',
      createdAt: NOW,
      status: 'active',
      metadata: undefined,
    });

    const meta1 = await gitRepo.readCommitMetadata(firstSha);
    const meta2 = await gitRepo.readCommitMetadata(secondSha);

    await revisions.create({
      id: 'rev-1',
      schemaVersion: '0.1.0',
      projectId: 'proj-1',
      gitCommitSha: meta1.sha,
      branchName: 'main',
      parentRevisionIds: [],
      author: meta1.authorName,
      message: meta1.message,
      createdAt: NOW,
      toolchain: { git: gitRepo.gitVersion },
      status: 'imported',
      metadata: undefined,
    });
    await revisions.create({
      id: 'rev-2',
      schemaVersion: '0.1.0',
      projectId: 'proj-1',
      gitCommitSha: meta2.sha,
      branchName: 'main',
      parentRevisionIds: ['rev-1'],
      author: meta2.authorName,
      message: meta2.message,
      createdAt: NOW,
      toolchain: { git: gitRepo.gitVersion },
      status: 'imported',
      metadata: undefined,
    });

    // restore both revisions from persistence and compare via the adapter
    const rev1 = await revisions.findById('rev-1');
    const rev2 = await revisions.findById('rev-2');
    expect(rev1).not.toBeNull();
    expect(rev2).not.toBeNull();
    expect(rev1!.gitCommitSha).toBe(firstSha);
    expect(rev2!.gitCommitSha).toBe(secondSha);

    const comparison = await gitRepo.compareCommits(rev1!.gitCommitSha, rev2!.gitCommitSha);
    expect(comparison.baseSha).toBe(firstSha);
    expect(comparison.headSha).toBe(secondSha);
    expect(comparison.mergeBaseSha).toBe(firstSha);
    expect(comparison.aheadCount).toBe(1);
    expect(comparison.behindCount).toBe(0);
    expect(comparison.changedFiles).toEqual([{ status: 'added', path: 'power.kicad_sch' }]);

    // ancestry holds between the registered revisions
    expect(await gitRepo.isAncestor(rev1!.gitCommitSha, rev2!.gitCommitSha)).toBe(true);

    // lookups by git SHA resolve back to the registered revisions
    const bySha = await revisions.findByGitCommitSha('proj-1', secondSha);
    expect(bySha!.id).toBe('rev-2');

    // every adapter call was audited
    expect(gitRepo.auditLog.length).toBeGreaterThan(0);
    for (const record of gitRepo.auditLog) {
      expect(record.command).toBe('git');
      expect(typeof record.exitCode).toBe('number');
    }

    db.close();
  });
});
