import { describe, it, expect } from 'vitest';
import { GitRepository } from '../src/git-repository.js';
import { createFixtureRepo, commitFile, headSha, git } from './helpers.js';

describe('GitRepository.merge', () => {
  it('fast-forwards when base is behind head', async () => {
    const dir = createFixtureRepo();
    git(dir, 'checkout', '-b', 'feature');
    const featureTip = commitFile(dir, 'f.txt', 'f', 'feature work');
    git(dir, 'checkout', 'main');

    const repo = await GitRepository.open(dir);
    const result = await repo.merge('main', 'feature', { message: 'merge feature' });
    expect(result.fastForward).toBe(true);
    expect(result.alreadyUpToDate).toBe(false);
    expect(result.sha).toBe(featureTip);
    expect(await repo.resolveCommitSha('main')).toBe(featureTip);
  });

  it('creates a merge commit when histories diverged', async () => {
    const dir = createFixtureRepo();
    git(dir, 'checkout', '-b', 'feature');
    const featureTip = commitFile(dir, 'f.txt', 'f', 'feature work');
    git(dir, 'checkout', 'main');
    const mainTip = commitFile(dir, 'm.txt', 'm', 'main work');

    const repo = await GitRepository.open(dir);
    const result = await repo.merge('main', 'feature', { message: 'merge feature into main' });
    expect(result.fastForward).toBe(false);
    expect(result.alreadyUpToDate).toBe(false);

    const info = await repo.readCommitMetadata(result.sha);
    expect(info.parents.sort()).toEqual([mainTip, featureTip].sort());
    expect(info.message).toBe('merge feature into main');
    expect(await repo.resolveCommitSha('main')).toBe(result.sha);
  });

  it('creates a merge commit instead of fast-forward when disallowed', async () => {
    const dir = createFixtureRepo();
    const baseTip = headSha(dir);
    git(dir, 'checkout', '-b', 'feature');
    const featureTip = commitFile(dir, 'f.txt', 'f', 'feature work');
    git(dir, 'checkout', 'main');

    const repo = await GitRepository.open(dir);
    const result = await repo.merge('main', 'feature', { message: 'no-ff merge', allowFastForward: false });
    expect(result.fastForward).toBe(false);
    const info = await repo.readCommitMetadata(result.sha);
    expect(info.parents.sort()).toEqual([baseTip, featureTip].sort());
  });

  it('reports already up to date when head is merged', async () => {
    const dir = createFixtureRepo();
    git(dir, 'checkout', '-b', 'feature');
    git(dir, 'checkout', 'main');
    const mainTip = commitFile(dir, 'm.txt', 'm', 'main advances');

    const repo = await GitRepository.open(dir);
    const result = await repo.merge('main', 'feature', { message: 'noop' });
    expect(result.alreadyUpToDate).toBe(true);
    expect(result.sha).toBe(mainTip);
  });

  it('blocks conflicting merges with LH_MERGE_BLOCKED and leaves base untouched', async () => {
    const dir = createFixtureRepo();
    git(dir, 'checkout', '-b', 'feature');
    commitFile(dir, 'README.md', 'feature version\n', 'feature edit');
    git(dir, 'checkout', 'main');
    const mainTip = commitFile(dir, 'README.md', 'main version\n', 'main edit');

    const repo = await GitRepository.open(dir);
    await expect(repo.merge('main', 'feature', { message: 'conflict' })).rejects.toThrow(/conflict/i);
    expect(await repo.resolveCommitSha('main')).toBe(mainTip);
  });

  it('does not touch the working tree during a merge commit', async () => {
    const dir = createFixtureRepo();
    git(dir, 'checkout', '-b', 'feature');
    commitFile(dir, 'f.txt', 'f', 'feature work');
    git(dir, 'checkout', 'main');
    commitFile(dir, 'm.txt', 'm', 'main work');

    const repo = await GitRepository.open(dir);
    await repo.merge('main', 'feature', { message: 'merge' });
    // HEAD still points at main whose tree changed, but the checkout
    // was never updated by us; the tree must remain consistent
    const state = await repo.validateState();
    // f.txt exists in the merge commit but not in the working tree —
    // git reports it as a deletion relative to the new HEAD
    expect(state.dirtyPaths).toContain('f.txt');
  });

  it('uses the provided merge author identity', async () => {
    const dir = createFixtureRepo();
    git(dir, 'checkout', '-b', 'feature');
    commitFile(dir, 'f.txt', 'f', 'feature work');
    git(dir, 'checkout', 'main');
    commitFile(dir, 'm.txt', 'm', 'main work');

    const repo = await GitRepository.open(dir);
    const result = await repo.merge('main', 'feature', {
      message: 'merge with identity',
      authorName: 'Merge Bot',
      authorEmail: 'bot@logichub.dev',
    });
    const info = await repo.readCommitMetadata(result.sha);
    expect(info.authorName).toBe('Merge Bot');
    expect(info.authorEmail).toBe('bot@logichub.dev');
  });
});
