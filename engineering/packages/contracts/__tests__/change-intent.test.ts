import { describe, it, expect } from 'vitest';
import { ChangeIntentSchema } from '../src/index.js';

const valid = {
  id: 'ci-1',
  projectId: 'proj-1',
  baseRevisionId: 'rev-1',
  targetBranch: 'feature/battery-input',
  title: 'Switch from USB to battery input',
  changeType: 'power_source_change',
  requestedOperations: [],
  expectedObjectChanges: [],
  preserve: ['sensor-connector'],
  optimize: ['power-efficiency'],
  constraints: [],
  approvalPolicy: { requiredApprovals: 1, autoMerge: false as const },
  createdBy: 'alice',
  createdAt: '2026-01-15T10:00:00+00:00',
};

describe('ChangeIntentSchema', () => {
  it('parses a valid change intent', () => {
    const result = ChangeIntentSchema.parse(valid);
    expect(result.status).toBe('captured');
    expect(result.approvalPolicy.autoMerge).toBe(false);
  });

  it('accepts all status values', () => {
    const statuses = ['captured', 'planned', 'executing', 'generated', 'validating', 'validated', 'review', 'accepted', 'rejected', 'failed', 'cancelled'];
    for (const s of statuses) {
      expect(() => ChangeIntentSchema.parse({ ...valid, status: s })).not.toThrow();
    }
  });

  it('rejects autoMerge: true', () => {
    expect(() => ChangeIntentSchema.parse({
      ...valid,
      approvalPolicy: { requiredApprovals: 1, autoMerge: true },
    })).toThrow();
  });

  it('rejects zero required approvals', () => {
    expect(() => ChangeIntentSchema.parse({
      ...valid,
      approvalPolicy: { requiredApprovals: 0, autoMerge: false },
    })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = ChangeIntentSchema.parse(valid);
    expect(ChangeIntentSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
