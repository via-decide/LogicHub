import { describe, it, expect } from 'vitest';
import {
  LogicHubError,
  LogicHubErrorSchema,
  createLogicHubError,
  LH_ERROR_CODES,
} from '../src/index.js';

describe('LogicHubError', () => {
  const payload = {
    code: 'LH_PROJECT_NOT_FOUND',
    message: 'Project xyz not found',
    correlationId: '550e8400-e29b-41d4-a716-446655440000',
    retryable: false,
    entityIds: { projectId: 'xyz' },
  };

  it('constructs with all fields', () => {
    const err = new LogicHubError(payload);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('LogicHubError');
    expect(err.code).toBe('LH_PROJECT_NOT_FOUND');
    expect(err.message).toBe('Project xyz not found');
    expect(err.correlationId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(err.retryable).toBe(false);
    expect(err.entityIds).toEqual({ projectId: 'xyz' });
  });

  it('toJSON produces valid LogicHubErrorSchema output', () => {
    const err = new LogicHubError(payload);
    const json = err.toJSON();
    expect(() => LogicHubErrorSchema.parse(json)).not.toThrow();
    expect(json.code).toBe('LH_PROJECT_NOT_FOUND');
  });

  it('works without optional fields', () => {
    const err = new LogicHubError({
      code: 'LH_TIMEOUT',
      message: 'Timed out',
      correlationId: '550e8400-e29b-41d4-a716-446655440000',
      retryable: true,
    });
    expect(err.entityIds).toBeUndefined();
    expect(err.diagnostics).toBeUndefined();
    expect(() => LogicHubErrorSchema.parse(err.toJSON())).not.toThrow();
  });
});

describe('createLogicHubError', () => {
  it('auto-populates retryable from error code definition', () => {
    const err = createLogicHubError('LH_TIMEOUT', 'Operation timed out');
    expect(err.retryable).toBe(true);
    expect(err.code).toBe('LH_TIMEOUT');
    expect(err.correlationId).toBeTruthy();
  });

  it('uses provided correlationId', () => {
    const err = createLogicHubError('LH_MERGE_BLOCKED', 'Blocked', {
      correlationId: 'aaaa-bbbb-cccc-dddd',
    });
    expect(err.correlationId).toBe('aaaa-bbbb-cccc-dddd');
    expect(err.retryable).toBe(false);
  });

  it('passes through entityIds and diagnostics', () => {
    const err = createLogicHubError('LH_REVISION_NOT_FOUND', 'Not found', {
      entityIds: { revisionId: 'rev-1' },
      diagnostics: { searched: ['db', 'cache'] },
    });
    expect(err.entityIds).toEqual({ revisionId: 'rev-1' });
    expect(err.diagnostics).toEqual({ searched: ['db', 'cache'] });
  });
});

describe('LH_ERROR_CODES', () => {
  it('has at least 28 error codes', () => {
    expect(Object.keys(LH_ERROR_CODES).length).toBeGreaterThanOrEqual(28);
  });

  it('every code has a retryable flag', () => {
    for (const [key, def] of Object.entries(LH_ERROR_CODES)) {
      expect(typeof def.retryable).toBe('boolean');
      expect(def.code).toBe(key);
    }
  });
});
