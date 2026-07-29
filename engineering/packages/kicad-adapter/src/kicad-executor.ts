import { execFile } from 'node:child_process';
import { createLogicHubError } from '@logichub-engineering/shared';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export interface ToolCommandAudit {
  command: string;
  args: readonly string[];
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  durationMs: number;
}

export interface ToolCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ToolExecutorOptions {
  timeoutMs?: number;
  onAudit?: (record: ToolCommandAudit) => void;
}

/**
 * Runs external tools (kicad-cli, python3) with argument arrays only —
 * no shell, bounded output, per-command timeout, full audit trail.
 * Non-zero exits are returned, not thrown; only timeouts and spawn
 * failures raise.
 */
export class ToolExecutor {
  private readonly timeoutMs: number;
  private readonly onAudit?: (record: ToolCommandAudit) => void;
  private readonly audits: ToolCommandAudit[] = [];

  constructor(options: ToolExecutorOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.onAudit = options.onAudit;
  }

  getAuditLog(): readonly ToolCommandAudit[] {
    return this.audits;
  }

  async run(command: string, args: readonly string[], cwd: string): Promise<ToolCommandResult> {
    for (const arg of args) {
      if (typeof arg !== 'string' || arg.includes('\0')) {
        throw createLogicHubError('LH_INTERNAL_ERROR', 'Tool argument contains a null byte or is not a string');
      }
    }

    const startedAt = new Date().toISOString();
    const startTime = performance.now();

    const result = await new Promise<ToolCommandResult>((resolvePromise, rejectPromise) => {
      execFile(command, args as string[], {
        cwd,
        timeout: this.timeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        if (error) {
          const err = error as NodeJS.ErrnoException & { killed?: boolean };
          if (err.killed) {
            rejectPromise(createLogicHubError('LH_TIMEOUT',
              `${command} exceeded ${this.timeoutMs}ms timeout`,
              { diagnostics: { command, args: [...args], cwd } }));
            return;
          }
          if (typeof err.code === 'string') {
            // Spawn failure (e.g. ENOENT when the tool is not installed).
            resolvePromise({ exitCode: 127, stdout: '', stderr: `spawn failed: ${err.code}` });
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

    const audit: ToolCommandAudit = {
      command,
      args: [...args],
      cwd,
      exitCode: result.exitCode,
      stdout: result.stdout.length > 65536 ? result.stdout.slice(0, 65536) + '…[truncated]' : result.stdout,
      stderr: result.stderr.length > 65536 ? result.stderr.slice(0, 65536) + '…[truncated]' : result.stderr,
      startedAt,
      durationMs: Math.round(performance.now() - startTime),
    };
    this.audits.push(audit);
    this.onAudit?.(audit);

    return result;
  }
}
