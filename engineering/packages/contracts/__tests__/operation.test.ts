import { describe, it, expect } from 'vitest';
import { OperationSchema } from '../src/index.js';

const ts = '2026-01-15T10:00:00+00:00';

const valid = {
  id: 'op-1',
  type: 'import_revision' as const,
  idempotencyKey: 'idem-abc',
  correlationId: 'corr-123',
  projectId: 'proj-1',
  revisionId: 'rev-1',
  createdAt: ts,
};

describe('OperationSchema', () => {
  it('parses a valid operation', () => {
    const result = OperationSchema.parse(valid);
    expect(result.id).toBe('op-1');
    expect(result.schemaVersion).toBe('0.1.0');
  });

  it('applies defaults for status, retryCount, arrays', () => {
    const result = OperationSchema.parse(valid);
    expect(result.status).toBe('queued');
    expect(result.retryCount).toBe(0);
    expect(result.maxRetries).toBe(3);
    expect(result.stages).toEqual([]);
    expect(result.artifacts).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.cleanupRequired).toBe(false);
  });

  it('accepts all operation types', () => {
    const types = ['import_project', 'import_revision', 'validate_revision', 'diff_revisions', 'create_pull_request', 'merge_pull_request'] as const;
    for (const t of types) {
      expect(OperationSchema.parse({ ...valid, type: t }).type).toBe(t);
    }
  });

  it('accepts all status values', () => {
    const statuses = ['queued', 'running', 'completed', 'failed', 'cancelled', 'cleaning_up'] as const;
    for (const s of statuses) {
      expect(OperationSchema.parse({ ...valid, status: s }).status).toBe(s);
    }
  });

  it('accepts stages with full data', () => {
    const result = OperationSchema.parse({
      ...valid,
      stages: [{ name: 'extract', status: 'completed', startedAt: ts, completedAt: ts }],
    });
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0].name).toBe('extract');
  });

  it('rejects invalid operation type', () => {
    expect(() => OperationSchema.parse({ ...valid, type: 'deploy' })).toThrow();
  });

  it('rejects negative retry count', () => {
    expect(() => OperationSchema.parse({ ...valid, retryCount: -1 })).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => OperationSchema.parse({})).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = OperationSchema.parse(valid);
    const roundtripped = OperationSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(roundtripped).toEqual(parsed);
  });
});
