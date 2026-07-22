import { describe, it, expect } from 'vitest';
import { GitExecutor } from '../src/git-executor.js';
import { createFixtureRepo } from './helpers.js';

describe('GitExecutor', () => {
  it('captures stdout and zero exit code', async () => {
    const repo = createFixtureRepo();
    const executor = new GitExecutor();
    const result = await executor.run(['-C', repo, 'rev-parse', 'HEAD'], repo);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^[0-9a-f]{40}$/);
    expect(result.stderr).toBe('');
  });

  it('returns non-zero exit code without throwing', async () => {
    const repo = createFixtureRepo();
    const executor = new GitExecutor();
    const result = await executor.run(['-C', repo, 'rev-parse', '--verify', 'no-such-ref'], repo);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('records audit entries for every invocation', async () => {
    const repo = createFixtureRepo();
    const executor = new GitExecutor();
    await executor.run(['-C', repo, 'status', '--porcelain'], repo);
    await executor.run(['-C', repo, 'rev-parse', 'HEAD'], repo);

    const log = executor.getAuditLog();
    expect(log).toHaveLength(2);
    expect(log[0]!.command).toBe('git');
    expect(log[0]!.args).toContain('status');
    expect(log[0]!.exitCode).toBe(0);
    expect(log[0]!.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(log[0]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(log[1]!.args).toContain('rev-parse');
  });

  it('invokes onAudit callback', async () => {
    const repo = createFixtureRepo();
    const seen: string[][] = [];
    const executor = new GitExecutor({ onAudit: (a) => seen.push([...a.args]) });
    await executor.run(['-C', repo, 'rev-parse', 'HEAD'], repo);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('rev-parse');
  });

  it('rejects arguments containing null bytes', async () => {
    const executor = new GitExecutor();
    await expect(executor.run(['rev-parse', 'HEAD\0--evil'], '/tmp')).rejects.toThrow(/null byte/i);
  });

  it('reports git version', async () => {
    const executor = new GitExecutor();
    const version = await executor.version();
    expect(version).toMatch(/^git version \d+\.\d+/);
  });

  it('treats option-like file names as data, not shell input', async () => {
    const repo = createFixtureRepo();
    const executor = new GitExecutor();
    const result = await executor.run(['-C', repo, 'log', '--format=%s', '-n', '1'], repo);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('initial commit');
  });
});
