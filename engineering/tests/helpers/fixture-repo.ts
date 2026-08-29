import { mkdtemp, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(HERE, '..', '..', 'fixtures', 'kicad', 'smart-plant-pot');
export const FIXTURE_BASE_DIR = join(FIXTURE_ROOT, 'base');
export const FIXTURE_PROPOSED_DIR = join(FIXTURE_ROOT, 'proposed');

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

export interface FixtureRepo {
  repoPath: string;
  baseBranch: string;
  headBranch: string;
  baseSha: string;
  headSha: string;
  cleanup(): Promise<void>;
}

/**
 * Materializes the smart-plant-pot fixture pair as two commits in a real git
 * repository: `baseBranch` (default 'main') at the base variant, and
 * `headBranch` at the proposed variant, branched from base. Used by any test
 * that needs buildFingerprint/GitRepository to operate on real KiCad files
 * rather than hand-built FingerprintDescriptor fixtures.
 */
export async function createSmartPlantPotFixtureRepo(options?: {
  baseBranch?: string;
  headBranch?: string;
}): Promise<FixtureRepo> {
  const baseBranch = options?.baseBranch ?? 'main';
  const headBranch = options?.headBranch ?? 'feature/proposed';

  const repoPath = await mkdtemp(join(tmpdir(), 'logichub-fixture-'));

  await git(['init', '-b', baseBranch], repoPath);
  await git(['config', 'user.email', 'fixture@logichub.test'], repoPath);
  await git(['config', 'user.name', 'LogicHub Fixture'], repoPath);
  await git(['config', 'commit.gpgsign', 'false'], repoPath);

  await cp(FIXTURE_BASE_DIR, repoPath, { recursive: true });
  await git(['add', '-A'], repoPath);
  await git(['commit', '-m', 'base: smart-plant-pot baseline'], repoPath);
  const baseSha = await git(['rev-parse', 'HEAD'], repoPath);

  await git(['checkout', '-b', headBranch], repoPath);
  await cp(FIXTURE_PROPOSED_DIR, repoPath, { recursive: true });
  await git(['add', '-A'], repoPath);
  await git(['commit', '-m', 'proposed: input protection, regulator swap, LED removal'], repoPath);
  const headSha = await git(['rev-parse', 'HEAD'], repoPath);

  await git(['checkout', baseBranch], repoPath);

  return {
    repoPath,
    baseBranch,
    headBranch,
    baseSha,
    headSha,
    cleanup: () => rm(repoPath, { recursive: true, force: true }),
  };
}
