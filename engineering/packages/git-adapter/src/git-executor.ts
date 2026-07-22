import { execFile } from 'node:child_process';
import { createLogicHubError } from '@logichub-engineering/shared';
import type { GitCommandAudit, GitCommandResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

export interface GitExecutorOptions {
  timeoutMs?: number;
  onAudit?: (record: GitCommandAudit) => void;
}

/**
 * Runs git with argument arrays only — user input is never interpolated
 * into a shell string. Every invocation is timed, bounded, and audited.
 * Non-zero exit codes are returned to the caller, not thrown; only
 * timeouts and spawn failures raise.
 */
export class GitExecutor {
  private readonly timeoutMs: number;
  private readonly onAudit?: (record: GitCommandAudit) => void;
  private readonly audits: GitCommandAudit[] = [];

  constructor(options: GitExecutorOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.onAudit = options.onAudit;
  }

  getAuditLog(): readonly GitCommandAudit[] {
    return this.audits;
  }

  async run(args: readonly string[], cwd: string, env?: Record<string, string>): Promise<GitCommandResult> {
    for (const arg of args) {
      if (typeof arg !== 'string' || arg.includes('\0')) {
        throw createLogicHubError('LH_INTERNAL_ERROR', 'Git argument contains a null byte or is not a string');
      }
    }

    const startedAt = new Date().toISOString();
    const startTime = performance.now();

    const result = await new Promise<GitCommandResult>((resolvePromise, rejectPromise) => {
      execFile('git', args as string[], {
        cwd,
        timeout: this.timeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        env: env ? { ...process.env, ...env } : process.env,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        if (error) {
          const err = error as NodeJS.ErrnoException & { killed?: boolean };
          if (err.killed) {
            rejectPromise(createLogicHubError('LH_TIMEOUT',
              `git ${args[0]} exceeded ${this.timeoutMs}ms timeout`,
              { diagnostics: { args: [...args], cwd } }));
            return;
          }
          if (typeof err.code === 'string') {
            rejectPromise(createLogicHubError('LH_INTERNAL_ERROR',
              `Failed to spawn git: ${err.message}`,
              { diagnostics: { args: [...args], cwd, spawnError: err.code } }));
            return;
          }
          resolvePromise({
            exitCode: typeof err.code === 'number' ? err.code : 1,
            stdout: stdout.toString(),
            stderr: stderr.toString(),
          });
          return;
        }
        resolvePromise({ exitCode: 0, stdout: stdout.toString(), stderr: stderr.toString() });
      });
    });

    const audit: GitCommandAudit = {
      command: 'git',
      args: [...args],
      cwd,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt,
      durationMs: Math.round(performance.now() - startTime),
    };
    this.audits.push(audit);
    this.onAudit?.(audit);

    return result;
  }

  async version(): Promise<string> {
    const result = await this.run(['--version'], process.cwd());
    return result.stdout.trim();
  }
}
