import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { LogicHubError, createLogicHubError, type LHErrorCode } from '@logichub-engineering/shared';

const STATUS_BY_CODE: Partial<Record<LHErrorCode, number>> = {
  LH_PROJECT_NOT_FOUND: 404,
  LH_REVISION_NOT_FOUND: 404,
  LH_ARTIFACT_NOT_FOUND: 404,
  LH_GIT_REF_NOT_FOUND: 404,
  LH_REPOSITORY_INVALID: 400,
  LH_REPOSITORY_DIRTY: 409,
  LH_GIT_ANCESTRY_INVALID: 409,
  LH_REVISION_IMMUTABLE: 409,
  LH_REVISION_STALE: 409,
  LH_REVISION_ALREADY_IMPORTED: 409,
  LH_SCHEMA_INVALID: 400,
  LH_ENGINEERING_OBJECT_INVALID: 400,
  LH_KICAD_PROJECT_INVALID: 400,
  LH_KICAD_VERSION_UNSUPPORTED: 400,
  LH_KICAD_IMPORT_FAILED: 502,
  LH_ERC_FAILED: 502,
  LH_DRC_FAILED: 502,
  LH_CONSTRAINT_VIOLATION: 409,
  LH_VALIDATION_REQUIRED: 409,
  LH_VALIDATION_FAILED: 502,
  LH_ARTIFACT_HASH_MISMATCH: 409,
  LH_DECISION_REQUIRED: 409,
  LH_REVIEW_REQUIRED: 409,
  LH_CHANGES_REQUESTED: 409,
  LH_MERGE_BLOCKED: 409,
  LH_STATE_TRANSITION_INVALID: 409,
  LH_TIMEOUT: 504,
  LH_RESOURCE_LIMIT: 429,
  LH_INTERNAL_ERROR: 500,
};

/** codes whose `diagnostics` are known to be safe, JSON-serializable, path-free structures we authored ourselves (e.g. merge-gate blockers). */
const DIAGNOSTICS_SAFE_TO_FORWARD = new Set<LHErrorCode>(['LH_MERGE_BLOCKED']);

export function correlationIdFromRequest(request: FastifyRequest): string {
  const header = request.headers['x-correlation-id'];
  const value = Array.isArray(header) ? header[0] : header;
  return value && value.length > 0 ? value : randomUUID();
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const correlationId = correlationIdFromRequest(request);
    (request as FastifyRequest & { correlationId: string }).correlationId = correlationId;
    reply.header('x-correlation-id', correlationId);
  });

  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = (request as FastifyRequest & { correlationId?: string }).correlationId ?? randomUUID();
    reply.header('x-correlation-id', correlationId);

    if (error instanceof LogicHubError) {
      const status = STATUS_BY_CODE[error.code as LHErrorCode] ?? 500;
      const payload = error.toJSON();
      reply.status(status).send({
        ...payload,
        correlationId,
        // Never forward diagnostics we did not author ourselves as a known-safe shape --
        // an underlying git-adapter/kicad-adapter error's diagnostics can carry
        // internal filesystem paths (temp working-tree directories).
        diagnostics: DIAGNOSTICS_SAFE_TO_FORWARD.has(error.code as LHErrorCode) ? payload.diagnostics : undefined,
      });
      return;
    }

    if (error instanceof ZodError) {
      const payload = createLogicHubError('LH_SCHEMA_INVALID', 'Request failed schema validation', {
        correlationId,
        diagnostics: { issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      }).toJSON();
      reply.status(400).send(payload);
      return;
    }

    const fastifyStatusCode = (error as { statusCode?: number }).statusCode;
    if (typeof fastifyStatusCode === 'number' && fastifyStatusCode < 500) {
      const message = error instanceof Error ? error.message : 'Bad request';
      const payload = createLogicHubError('LH_SCHEMA_INVALID', message, { correlationId }).toJSON();
      reply.status(fastifyStatusCode).send(payload);
      return;
    }

    request.log.error(error);
    const payload = createLogicHubError('LH_INTERNAL_ERROR', 'Internal server error', { correlationId }).toJSON();
    reply.status(500).send(payload);
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = (request as FastifyRequest & { correlationId?: string }).correlationId ?? randomUUID();
    reply.header('x-correlation-id', correlationId);
    const payload = createLogicHubError('LH_REVISION_NOT_FOUND', `No route matches ${request.method} ${request.url}`, {
      correlationId,
    }).toJSON();
    reply.status(404).send(payload);
  });
}
