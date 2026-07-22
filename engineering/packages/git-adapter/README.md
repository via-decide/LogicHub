# @logichub-engineering/git-adapter

Restricted Git adapter (Phase 3). Exposes only the operations LogicHub needs:

- `GitRepository.open` / `GitRepository.init` — register or create a repository (path validated, must be the repo root)
- `validateState` / `assertClean` — working-tree cleanliness
- `listBranches`, `createBranch` — branch reads and creation
- `resolveCommitSha`, `readCommitMetadata` — commit resolution and metadata
- `listChangedFiles`, `compareCommits`, `mergeBase`, `isAncestor` — comparison and ancestry
- `checkStaleBase` — stale PR-base detection (including rewritten history)
- `merge` — controlled fast-forward or merge commit via plumbing (`merge-tree` + `commit-tree` + `update-ref`); conflicts throw `LH_MERGE_BLOCKED`, concurrent branch movement throws `LH_REVISION_STALE`
- `restoreWorkingTree` / `removeWorkingTree` — isolated detached worktrees for processing

Safety properties:

- All git invocations use argument arrays (`execFile`) — no shell, no interpolation.
- Branch names, refs, and repository paths are validated; `--end-of-options` / `--` separators prevent refs being parsed as flags.
- Every command runs with a timeout (`LH_TIMEOUT`) and bounded output.
- Every invocation is recorded in an audit log (args, cwd, exit code, stdout, stderr, duration).
- Merges never touch the working tree.

Requires git >= 2.38 (`merge-tree --write-tree`).
