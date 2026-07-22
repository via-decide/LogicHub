import { stat } from 'node:fs/promises';
import { createLogicHubError } from '@logichub-engineering/shared';
import { GitExecutor, type GitExecutorOptions } from './git-executor.js';
import { assertSafeRepositoryPath, assertValidBranchName, assertValidRef } from './validation.js';
import type {
  BranchInfo, ChangedFile, ChangeStatus, CommitComparison, CommitInfo,
  MergeOptions, MergeResult, RepositoryState, StaleBaseCheck,
} from './types.js';

const STATUS_MAP: Record<string, ChangeStatus> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  T: 'type_changed',
};

export interface GitRepositoryOptions extends GitExecutorOptions {}

/**
 * Restricted Git adapter. Only the operations LogicHub needs are exposed;
 * every ref and path is validated before reaching git, and `--` separators
 * keep refs from being parsed as options.
 */
export class GitRepository {
  private constructor(
    readonly path: string,
    readonly gitVersion: string,
    private readonly executor: GitExecutor,
  ) {}

  get auditLog() {
    return this.executor.getAuditLog();
  }

  /** Register an existing repository. The path must be the repository root. */
  static async open(repoPath: string, options: GitRepositoryOptions = {}): Promise<GitRepository> {
    const resolved = assertSafeRepositoryPath(repoPath);

    let stats;
    try {
      stats = await stat(resolved);
    } catch {
      throw createLogicHubError('LH_REPOSITORY_INVALID',
        `Repository path does not exist: '${resolved}'`,
        { diagnostics: { path: resolved } });
    }
    if (!stats.isDirectory()) {
      throw createLogicHubError('LH_REPOSITORY_INVALID',
        `Repository path is not a directory: '${resolved}'`,
        { diagnostics: { path: resolved } });
    }

    const executor = new GitExecutor(options);
    const toplevel = await executor.run(['rev-parse', '--show-toplevel'], resolved);
    if (toplevel.exitCode !== 0) {
      throw createLogicHubError('LH_REPOSITORY_INVALID',
        `Not a git repository: '${resolved}'`,
        { diagnostics: { path: resolved, stderr: toplevel.stderr.trim() } });
    }
    if (toplevel.stdout.trim() !== resolved) {
      throw createLogicHubError('LH_REPOSITORY_INVALID',
        `Path is not the repository root (root is '${toplevel.stdout.trim()}')`,
        { diagnostics: { path: resolved, root: toplevel.stdout.trim() } });
    }

    const gitVersion = await executor.version();
    return new GitRepository(resolved, gitVersion, executor);
  }

  /** Initialize a new repository and register it. */
  static async init(repoPath: string, defaultBranch = 'main', options: GitRepositoryOptions = {}): Promise<GitRepository> {
    const resolved = assertSafeRepositoryPath(repoPath);
    assertValidBranchName(defaultBranch);

    const executor = new GitExecutor(options);
    const result = await executor.run(['init', '-b', defaultBranch, '--', resolved], process.cwd());
    if (result.exitCode !== 0) {
      throw createLogicHubError('LH_REPOSITORY_INVALID',
        `git init failed: ${result.stderr.trim()}`,
        { diagnostics: { path: resolved } });
    }
    const gitVersion = await executor.version();
    return new GitRepository(resolved, gitVersion, executor);
  }

  /** Report whether the working tree is clean. */
  async validateState(): Promise<RepositoryState> {
    const result = await this.run(['status', '--porcelain', '-z']);
    const dirtyPaths = result.stdout
      .split('\0')
      .filter(entry => entry.length > 0)
      .map(entry => entry.slice(3));
    return { clean: dirtyPaths.length === 0, dirtyPaths };
  }

  /** Throw LH_REPOSITORY_DIRTY unless the working tree is clean. */
  async assertClean(): Promise<void> {
    const state = await this.validateState();
    if (!state.clean) {
      throw createLogicHubError('LH_REPOSITORY_DIRTY',
        `Working tree has ${state.dirtyPaths.length} uncommitted change(s)`,
        { diagnostics: { dirtyPaths: state.dirtyPaths } });
    }
  }

  async listBranches(): Promise<BranchInfo[]> {
    const result = await this.run(['for-each-ref', 'refs/heads', '--format=%(refname:short)%00%(objectname)']);
    return result.stdout
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => {
        const [name, sha] = line.split('\0');
        return { name: name!, sha: sha! };
      });
  }

  async createBranch(name: string, startPoint: string): Promise<BranchInfo> {
    assertValidBranchName(name);
    assertValidRef(startPoint);
    const startSha = await this.resolveCommitSha(startPoint);
    const result = await this.run(['branch', '--', name, startSha]);
    if (result.exitCode !== 0) {
      throw createLogicHubError('LH_GIT_REF_NOT_FOUND',
        `Failed to create branch '${name}': ${result.stderr.trim()}`,
        { diagnostics: { branchName: name, startPoint } });
    }
    return { name, sha: startSha };
  }

  /** Resolve a branch name, SHA prefix, or HEAD to a full commit SHA. */
  async resolveCommitSha(ref: string): Promise<string> {
    assertValidRef(ref);
    const result = await this.run(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
    if (result.exitCode !== 0) {
      throw createLogicHubError('LH_GIT_REF_NOT_FOUND',
        `Cannot resolve ref '${ref}' to a commit`,
        { diagnostics: { ref, stderr: result.stderr.trim() } });
    }
    return result.stdout.trim();
  }

  async readCommitMetadata(ref: string): Promise<CommitInfo> {
    const sha = await this.resolveCommitSha(ref);
    const format = '%H%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%P%x00%B';
    const result = await this.run(['show', '-s', `--format=${format}`, '--end-of-options', sha]);
    if (result.exitCode !== 0) {
      throw createLogicHubError('LH_GIT_REF_NOT_FOUND',
        `Cannot read commit ${sha}`,
        { diagnostics: { sha, stderr: result.stderr.trim() } });
    }
    const [fullSha, authorName, authorEmail, authoredAt, committerName, committerEmail, committedAt, parents, ...messageParts] =
      result.stdout.split('\0');
    return {
      sha: fullSha!,
      authorName: authorName!,
      authorEmail: authorEmail!,
      authoredAt: authoredAt!,
      committerName: committerName!,
      committerEmail: committerEmail!,
      committedAt: committedAt!,
      parents: parents!.length > 0 ? parents!.split(' ') : [],
      message: messageParts.join('\0').replace(/\n+$/, ''),
    };
  }

  async listChangedFiles(baseRef: string, headRef: string): Promise<ChangedFile[]> {
    const baseSha = await this.resolveCommitSha(baseRef);
    const headSha = await this.resolveCommitSha(headRef);
    const result = await this.run(['diff', '--name-status', '-M', '-z', '--end-of-options', baseSha, headSha]);
    if (result.exitCode !== 0) {
      throw createLogicHubError('LH_INTERNAL_ERROR',
        `git diff failed: ${result.stderr.trim()}`,
        { diagnostics: { baseSha, headSha } });
    }

    const tokens = result.stdout.split('\0').filter(t => t.length > 0);
    const files: ChangedFile[] = [];
    let i = 0;
    while (i < tokens.length) {
      const rawStatus = tokens[i]!;
      const statusChar = rawStatus[0]!;
      const status = STATUS_MAP[statusChar];
      if (!status) {
        i += 2;
        continue;
      }
      if (status === 'renamed' || status === 'copied') {
        files.push({ status, oldPath: tokens[i + 1]!, path: tokens[i + 2]! });
        i += 3;
      } else {
        files.push({ status, path: tokens[i + 1]! });
        i += 2;
      }
    }
    return files;
  }

  /** Check whether `ancestorRef` is an ancestor of `descendantRef`. */
  async isAncestor(ancestorRef: string, descendantRef: string): Promise<boolean> {
    const ancestorSha = await this.resolveCommitSha(ancestorRef);
    const descendantSha = await this.resolveCommitSha(descendantRef);
    const result = await this.run(['merge-base', '--is-ancestor', ancestorSha, descendantSha]);
    if (result.exitCode === 0) return true;
    if (result.exitCode === 1) return false;
    throw createLogicHubError('LH_GIT_ANCESTRY_INVALID',
      `Ancestry check failed: ${result.stderr.trim()}`,
      { diagnostics: { ancestorSha, descendantSha } });
  }

  async mergeBase(refA: string, refB: string): Promise<string | null> {
    const shaA = await this.resolveCommitSha(refA);
    const shaB = await this.resolveCommitSha(refB);
    const result = await this.run(['merge-base', shaA, shaB]);
    if (result.exitCode !== 0) return null;
    return result.stdout.trim();
  }

  /** Compare two commits: merge base, ahead/behind counts, changed files. */
  async compareCommits(baseRef: string, headRef: string): Promise<CommitComparison> {
    const baseSha = await this.resolveCommitSha(baseRef);
    const headSha = await this.resolveCommitSha(headRef);
    const mergeBaseSha = await this.mergeBase(baseSha, headSha);

    let aheadCount = 0;
    let behindCount = 0;
    if (mergeBaseSha !== null) {
      const counts = await this.run(['rev-list', '--left-right', '--count', `${baseSha}...${headSha}`]);
      if (counts.exitCode !== 0) {
        throw createLogicHubError('LH_GIT_ANCESTRY_INVALID',
          `rev-list failed: ${counts.stderr.trim()}`,
          { diagnostics: { baseSha, headSha } });
      }
      const [behind, ahead] = counts.stdout.trim().split(/\s+/).map(Number);
      behindCount = behind ?? 0;
      aheadCount = ahead ?? 0;
    }

    const changedFiles = await this.listChangedFiles(baseSha, headSha);
    return { baseSha, headSha, mergeBaseSha, aheadCount, behindCount, changedFiles };
  }

  /**
   * A recorded PR base is stale when the base branch has moved past it.
   * `historyRewritten` flags the worse case where the recorded SHA is no
   * longer an ancestor of the branch tip at all.
   */
  async checkStaleBase(baseBranch: string, recordedBaseSha: string): Promise<StaleBaseCheck> {
    assertValidBranchName(baseBranch);
    const currentBaseSha = await this.resolveCommitSha(baseBranch);
    const recordedSha = await this.resolveCommitSha(recordedBaseSha);
    if (currentBaseSha === recordedSha) {
      return { stale: false, recordedBaseSha: recordedSha, currentBaseSha, historyRewritten: false };
    }
    const stillAncestor = await this.isAncestor(recordedSha, currentBaseSha);
    return {
      stale: true,
      recordedBaseSha: recordedSha,
      currentBaseSha,
      historyRewritten: !stillAncestor,
    };
  }

  /**
   * Controlled merge of `headRef` into `baseBranch` using plumbing commands —
   * the working tree is never touched. Fast-forwards when possible (and
   * allowed); otherwise writes a merge commit via merge-tree + commit-tree.
   * Conflicts abort with LH_MERGE_BLOCKED.
   */
  async merge(baseBranch: string, headRef: string, options: MergeOptions): Promise<MergeResult> {
    assertValidBranchName(baseBranch);
    const baseSha = await this.resolveCommitSha(baseBranch);
    const headSha = await this.resolveCommitSha(headRef);
    const allowFastForward = options.allowFastForward ?? true;

    if (await this.isAncestor(headSha, baseSha)) {
      return { sha: baseSha, fastForward: false, alreadyUpToDate: true };
    }

    if (allowFastForward && await this.isAncestor(baseSha, headSha)) {
      await this.updateBranchRef(baseBranch, headSha, baseSha);
      return { sha: headSha, fastForward: true, alreadyUpToDate: false };
    }

    const mergeTree = await this.run(['merge-tree', '--write-tree', '--name-only', baseSha, headSha]);
    if (mergeTree.exitCode === 1) {
      const lines = mergeTree.stdout.split('\n').filter(l => l.length > 0);
      const conflictedFiles = lines.slice(1);
      throw createLogicHubError('LH_MERGE_BLOCKED',
        `Merge of '${headRef}' into '${baseBranch}' has conflicts`,
        { diagnostics: { baseSha, headSha, conflictedFiles } });
    }
    if (mergeTree.exitCode !== 0) {
      throw createLogicHubError('LH_INTERNAL_ERROR',
        `merge-tree failed: ${mergeTree.stderr.trim()}`,
        { diagnostics: { baseSha, headSha } });
    }
    const treeSha = mergeTree.stdout.split('\n')[0]!.trim();

    const identityEnv = {
      GIT_AUTHOR_NAME: options.authorName ?? 'LogicHub',
      GIT_AUTHOR_EMAIL: options.authorEmail ?? 'logichub@localhost',
      GIT_COMMITTER_NAME: options.authorName ?? 'LogicHub',
      GIT_COMMITTER_EMAIL: options.authorEmail ?? 'logichub@localhost',
    };
    const commitTree = await this.run(
      ['commit-tree', treeSha, '-p', baseSha, '-p', headSha, '-m', options.message],
      identityEnv,
    );
    if (commitTree.exitCode !== 0) {
      throw createLogicHubError('LH_INTERNAL_ERROR',
        `commit-tree failed: ${commitTree.stderr.trim()}`,
        { diagnostics: { treeSha, baseSha, headSha } });
    }
    const mergeSha = commitTree.stdout.trim();

    await this.updateBranchRef(baseBranch, mergeSha, baseSha);
    return { sha: mergeSha, fastForward: false, alreadyUpToDate: false };
  }

  /** Check out a commit into an isolated worktree for processing. */
  async restoreWorkingTree(ref: string, targetDir: string): Promise<string> {
    const sha = await this.resolveCommitSha(ref);
    const resolvedTarget = assertSafeRepositoryPath(targetDir);
    const result = await this.run(['worktree', 'add', '--detach', '--', resolvedTarget, sha]);
    if (result.exitCode !== 0) {
      throw createLogicHubError('LH_INTERNAL_ERROR',
        `Failed to create worktree at '${resolvedTarget}': ${result.stderr.trim()}`,
        { diagnostics: { sha, targetDir: resolvedTarget } });
    }
    return resolvedTarget;
  }

  async removeWorkingTree(targetDir: string): Promise<void> {
    const resolvedTarget = assertSafeRepositoryPath(targetDir);
    const result = await this.run(['worktree', 'remove', '--force', '--', resolvedTarget]);
    if (result.exitCode !== 0) {
      throw createLogicHubError('LH_INTERNAL_ERROR',
        `Failed to remove worktree at '${resolvedTarget}': ${result.stderr.trim()}`,
        { diagnostics: { targetDir: resolvedTarget } });
    }
  }

  private async updateBranchRef(branch: string, newSha: string, expectedOldSha: string): Promise<void> {
    const result = await this.run(['update-ref', `refs/heads/${branch}`, newSha, expectedOldSha]);
    if (result.exitCode !== 0) {
      throw createLogicHubError('LH_REVISION_STALE',
        `Branch '${branch}' moved during merge (expected ${expectedOldSha})`,
        { diagnostics: { branch, newSha, expectedOldSha, stderr: result.stderr.trim() } });
    }
  }

  private run(args: readonly string[], env?: Record<string, string>) {
    return this.executor.run(['-C', this.path, ...args], this.path, env);
  }
}
