import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const GIT_ID = [
  '-c', 'user.name=Test User',
  '-c', 'user.email=test@example.com',
];

export function makeTempDir(prefix = 'git-adapter-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function git(repoDir: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repoDir, ...GIT_ID, ...args], { encoding: 'utf-8' });
}

/** Create a repo with an initial commit on `main`. Returns the repo path. */
export function createFixtureRepo(): string {
  const dir = makeTempDir();
  execFileSync('git', ['init', '-b', 'main', dir], { encoding: 'utf-8' });
  writeFileSync(join(dir, 'README.md'), '# Fixture\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-m', 'initial commit');
  return dir;
}

export function commitFile(repoDir: string, relPath: string, content: string, message: string): string {
  const abs = join(repoDir, relPath);
  const parent = abs.slice(0, abs.lastIndexOf('/'));
  mkdirSync(parent, { recursive: true });
  writeFileSync(abs, content);
  git(repoDir, 'add', '-A');
  git(repoDir, 'commit', '-m', message);
  return headSha(repoDir);
}

export function headSha(repoDir: string): string {
  return git(repoDir, 'rev-parse', 'HEAD').trim();
}
