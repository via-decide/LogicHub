import { z } from 'zod';
import { LH_ERROR_CODES, type LHErrorCode } from './error-codes.js';

/**
 * A correlation id from the Web Crypto API rather than node:crypto, so this
 * package runs unchanged in a browser as well as on the server. The engine is
 * meant to run on the user's own machine, which means it has to bundle.
 */
function newCorrelationId(): string {
  return globalThis.crypto.randomUUID();
}

export const LogicHubErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string().uuid(),
  retryable: z.boolean(),
  entityIds: z.record(z.string(), z.string()).optional(),
  diagnostics: z.record(z.string(), z.unknown()).optional(),
});

export type LogicHubErrorPayload = z.infer<typeof LogicHubErrorSchema>;

export class LogicHubError extends Error {
  public readonly code: string;
  public readonly correlationId: string;
  public readonly retryable: boolean;
  public readonly entityIds?: Record<string, string>;
  public readonly diagnostics?: Record<string, unknown>;

  constructor(payload: LogicHubErrorPayload) {
    super(payload.message);
    this.name = 'LogicHubError';
    this.code = payload.code;
    this.correlationId = payload.correlationId;
    this.retryable = payload.retryable;
    this.entityIds = payload.entityIds;
    this.diagnostics = payload.diagnostics;
  }

  toJSON(): LogicHubErrorPayload {
    return {
      code: this.code,
      message: this.message,
      correlationId: this.correlationId,
      retryable: this.retryable,
      entityIds: this.entityIds,
      diagnostics: this.diagnostics,
    };
  }
}

export function createLogicHubError(
  code: LHErrorCode,
  message: string,
  options?: {
    entityIds?: Record<string, string>;
    diagnostics?: Record<string, unknown>;
    correlationId?: string;
  },
): LogicHubError {
  const def = LH_ERROR_CODES[code];
  return new LogicHubError({
    code: def.code,
    message,
    correlationId: options?.correlationId ?? newCorrelationId(),
    retryable: def.retryable,
    entityIds: options?.entityIds,
    diagnostics: options?.diagnostics,
  });
}
