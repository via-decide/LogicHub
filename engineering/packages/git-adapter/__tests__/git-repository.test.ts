import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { GitRepository } from '../src/git-repository.js';
import { createFixtureRepo, commitFile, headSha, git, makeTempDir } from './helpers.js';

describe('GitRepository.open', () => {
  it('opens an existing repository', async () => {
    const dir = createFixtureRepo();
    const repo = await GitRepository.open(dir);
    expect(repo.path).toBe(dir);
    expect(repo.gitVersion).toMatch(/^git version/);
  });

  it('rejects a non-existent path', async () => {
    await expect(GitRepository.open('/tmp/does-not-exist-xyz')).rejects.toThrow(/does not exist/i);
  });

  it('rejects a directory that is not a git repository', async () => {
    const dir = makeTempDir();
    await expect(GitRepository.open(dir)).rejects.toThrow(/not a git repository/i);
  });

  it('rejects a subdirectory of a repository', async () => {
    const dir = createFixtureRepo();
    const sub = join(dir, 'subdir');
    mkdirSync(sub);
    await expect(GitRepository.open(sub)).rejects.toThrow(/repository root/i);
  });

  it('rejects relative paths', async () => {
    await expect(GitRepository.open('relative/repo')).rejects.toThrow(/absolute/i);
  });
});

describe('GitRepository.init', () => {
  it('initializes a new repository with the given default branch', async () => {
    const dir = makeTempDir();
    const repo = await GitRepository.init(dir, 'trunk');
    expect(repo.path).toBe(dir);
    writeFileSync(join(dir, 'a.txt'), 'a');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-m', 'first');
    const branches = await repo.listBranches();
    expect(branches.map(b => b.name)).toEqual(['trunk']);
  });
});

describe('repository state', () => {
  it('reports clean tree', async () => {
    const dir = createFixtureRepo();
    const repo = await GitRepository.open(dir);
    const state = await repo.validateState();
    expect(state.clean).toBe(true);
    expect(state.dirtyPaths).toEqual([]);
  });

  it('reports dirty paths', async () => {
    const dir = createFixtureRepo();
    writeFileSync(join(dir, 'untracked.txt'), 'x');
    const repo = await GitRepository.open(dir);
    const state = await repo.validateState();
    expect(state.clean).toBe(false);
    expect(state.dirtyPaths).toContain('untracked.txt');
  });

  it('assertClean throws LH_REPOSITORY_DIRTY on dirty tree', async () => {
    const dir = createFixtureRepo();
    writeFileSync(join(dir, 'untracked.txt'), 'x');
    const repo = await GitRepository.open(dir);
    await expect(repo.assertClean()).rejects.toThrow(/uncommitted/i);
  });
});

describe('branches and refs', () => {
  it('lists branches with SHAs', async () => {
    const dir = createFixtureRepo();
    const sha = headSha(dir);
    const repo = await GitRepository.open(dir);
    const branches = await repo.listBranches();
    expect(branches).toEqual([{ name: 'main', sha }]);
  });

  it('creates a branch at a start point', async () => {
    const dir = createFixtureRepo();
    const first = headSha(dir);
    commitFile(dir, 'b.txt', 'b', 'second');
    const repo = await GitRepository.open(dir);
    const branch = await repo.createBranch('feature/x', first);
    expect(branch).toEqual({ name: 'feature/x', sha: first });
    const branches = await repo.listBranches();
    expect(branches.map(b => b.name).sort()).toEqual(['feature/x', 'main']);
  });

  it('rejects invalid branch names on create', async () => {
    const dir = createFixtureRepo();
    const repo = await GitRepository.open(dir);
    await expect(repo.createBranch('--force', 'HEAD')).rejects.toThrow(/invalid branch name/i);
  });

  it('resolves branch names and HEAD to full SHAs', async () => {
    const dir = createFixtureRepo();
    const sha = headSha(dir);
    const repo = await GitRepository.open(dir);
    expect(await repo.resolveCommitSha('main')).toBe(sha);
    expect(await repo.resolveCommitSha('HEAD')).toBe(sha);
    expect(await repo.resolveCommitSha(sha.slice(0, 8))).toBe(sha);
  });

  it('throws LH_GIT_REF_NOT_FOUND for unknown refs', async () => {
    const dir = createFixtureRepo();
    const repo = await GitRepository.open(dir);
    await expect(repo.resolveCommitSha('no-such-branch')).rejects.toThrow(/cannot resolve/i);
  });
});

describe('commit metadata', () => {
  it('reads author, committer, parents, and message', async () => {
    const dir = createFixtureRepo();
    const first = headSha(dir);
    const second = commitFile(dir, 'b.txt', 'b', 'second commit\n\nwith a body');
    const repo = await GitRepository.open(dir);

    const info = await repo.readCommitMetadata(second);
    expect(info.sha).toBe(second);
    expect(info.authorName).toBe('Test User');
    expect(info.authorEmail).toBe('test@example.com');
    expect(info.parents).toEqual([first]);
    expect(info.message).toBe('second commit\n\nwith a body');
    expect(info.authoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const rootInfo = await repo.readCommitMetadata(first);
    expect(rootInfo.parents).toEqual([]);
  });
});

describe('changed files and comparison', () => {
  it('lists added, modified, and deleted files', async () => {
    const dir = createFixtureRepo();
    const base = headSha(dir);
    commitFile(dir, 'new.txt', 'new', 'add file');
    const mid = commitFile(dir, 'README.md', '# Changed\n', 'modify readme');
    git(dir, 'rm', 'new.txt');
    git(dir, 'commit', '-m', 'delete file');
    const head = headSha(dir);

    const repo = await GitRepository.open(dir);
    const files = await repo.listChangedFiles(base, head);
    expect(files).toEqual([{ status: 'modified', path: 'README.md' }]);

    const midFiles = await repo.listChangedFiles(base, mid);
    expect(midFiles).toHaveLength(2);
    expect(midFiles).toContainEqual({ status: 'modified', path: 'README.md' });
    expect(midFiles).toContainEqual({ status: 'added', path: 'new.txt' });
  });

  it('detects renames', async () => {
    const dir = createFixtureRepo();
    const base = headSha(dir);
    git(dir, 'mv', 'README.md', 'DOCS.md');
    git(dir, 'commit', '-m', 'rename');
    const repo = await GitRepository.open(dir);
    const files = await repo.listChangedFiles(base, 'HEAD');
    expect(files).toEqual([{ status: 'renamed', oldPath: 'README.md', path: 'DOCS.md' }]);
  });

  it('compares two commits with ahead/behind counts', async () => {
    const dir = createFixtureRepo();
    const base = headSha(dir);
    git(dir, 'checkout', '-b', 'feature');
    commitFile(dir, 'f1.txt', '1', 'feature 1');
    commitFile(dir, 'f2.txt', '2', 'feature 2');
    const head = headSha(dir);
    git(dir, 'checkout', 'main');
    commitFile(dir, 'm1.txt', 'm', 'main 1');

    const repo = await GitRepository.open(dir);
    const cmp = await repo.compareCommits('main', head);
    expect(cmp.mergeBaseSha).toBe(base);
    expect(cmp.aheadCount).toBe(2);
    expect(cmp.behindCount).toBe(1);
    expect(cmp.changedFiles.map(f => f.path).sort()).toEqual(['f1.txt', 'f2.txt', 'm1.txt']);
  });
});

describe('ancestry and stale base', () => {
  it('detects ancestry', async () => {
    const dir = createFixtureRepo();
    const first = headSha(dir);
    const second = commitFile(dir, 'b.txt', 'b', 'second');
    const repo = await GitRepository.open(dir);
    expect(await repo.isAncestor(first, second)).toBe(true);
    expect(await repo.isAncestor(second, first)).toBe(false);
  });

  it('reports fresh base when branch has not moved', async () => {
    const dir = createFixtureRepo();
    const tip = headSha(dir);
    const repo = await GitRepository.open(dir);
    const check = await repo.checkStaleBase('main', tip);
    expect(check.stale).toBe(false);
    expect(check.historyRewritten).toBe(false);
  });

  it('reports stale base when branch advanced', async () => {
    const dir = createFixtureRepo();
    const recorded = headSha(dir);
    commitFile(dir, 'b.txt', 'b', 'advance main');
    const repo = await GitRepository.open(dir);
    const check = await repo.checkStaleBase('main', recorded);
    expect(check.stale).toBe(true);
    expect(check.historyRewritten).toBe(false);
    expect(check.currentBaseSha).toBe(headSha(dir));
  });

  it('flags rewritten history', async () => {
    const dir = createFixtureRepo();
    commitFile(dir, 'b.txt', 'b', 'to be rewritten');
    const recorded = headSha(dir);
    git(dir, 'reset', '--hard', 'HEAD~1');
    commitFile(dir, 'c.txt', 'c', 'replacement commit');
    const repo = await GitRepository.open(dir);
    const check = await repo.checkStaleBase('main', recorded);
    expect(check.stale).toBe(true);
    expect(check.historyRewritten).toBe(true);
  });
});

describe('isolated worktrees', () => {
  it('restores a commit into an isolated worktree and removes it', async () => {
    const dir = createFixtureRepo();
    const first = headSha(dir);
    commitFile(dir, 'b.txt', 'b', 'second');

    const repo = await GitRepository.open(dir);
    const target = join(makeTempDir('worktree-'), 'checkout');
    await repo.restoreWorkingTree(first, target);

    const { readFileSync, existsSync } = await import('node:fs');
    expect(readFileSync(join(target, 'README.md'), 'utf-8')).toBe('# Fixture\n');
    expect(existsSync(join(target, 'b.txt'))).toBe(false);

    await repo.removeWorkingTree(target);
    expect(existsSync(target)).toBe(false);
  });
});
