export type {
  GitCommandAudit,
  GitCommandResult,
  BranchInfo,
  CommitInfo,
  ChangeStatus,
  ChangedFile,
  CommitComparison,
  RepositoryState,
  StaleBaseCheck,
  MergeResult,
  MergeOptions,
} from './types.js';

export { GitExecutor, type GitExecutorOptions } from './git-executor.js';
export { GitRepository, type GitRepositoryOptions } from './git-repository.js';
export { isSha, assertValidBranchName, assertValidRef, assertSafeRepositoryPath } from './validation.js';
