export interface GitCommandAudit {
  command: 'git';
  args: readonly string[];
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  durationMs: number;
}

export interface GitCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface BranchInfo {
  name: string;
  sha: string;
}

export interface CommitInfo {
  sha: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committerName: string;
  committerEmail: string;
  committedAt: string;
  parents: string[];
  message: string;
}

export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'type_changed';

export interface ChangedFile {
  status: ChangeStatus;
  path: string;
  oldPath?: string;
}

export interface CommitComparison {
  baseSha: string;
  headSha: string;
  mergeBaseSha: string | null;
  aheadCount: number;
  behindCount: number;
  changedFiles: ChangedFile[];
}

export interface RepositoryState {
  clean: boolean;
  dirtyPaths: string[];
}

export interface StaleBaseCheck {
  stale: boolean;
  recordedBaseSha: string;
  currentBaseSha: string;
  historyRewritten: boolean;
}

export interface MergeResult {
  sha: string;
  fastForward: boolean;
  alreadyUpToDate: boolean;
}

export interface MergeOptions {
  message: string;
  allowFastForward?: boolean;
  authorName?: string;
  authorEmail?: string;
}
