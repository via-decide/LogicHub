import { describe, it, expect } from 'vitest';
import { ConstraintSchema } from '../src/index.js';

const valid = {
  id: 'con-1',
  projectId: 'proj-1',
  revisionId: 'rev-1',
  name: 'Maximum board width',
  category: 'mechanical' as const,
  severity: 'blocking' as const,
  scope: 'revision',
  targetObjectIds: ['eo-pcb-1'],
  expression: { operator: 'less_than_or_equal', left: { object: 'pcb.main', property: 'boundingBox.widthMm' }, right: 100 },
  createdBy: 'alice',
  createdAt: '2026-01-15T10:00:00+00:00',
};

describe('ConstraintSchema', () => {
  it('parses a valid constraint', () => {
    const result = ConstraintSchema.parse(valid);
    expect(result.evaluation).toBe('unknown');
    expect(result.category).toBe('mechanical');
  });

  it('accepts all 9 categories', () => {
    const cats = ['electrical', 'mechanical', 'thermal', 'manufacturing', 'supply_chain', 'cost', 'reliability', 'interface', 'project_policy'];
    for (const c of cats) {
      expect(() => ConstraintSchema.parse({ ...valid, category: c })).not.toThrow();
    }
  });

  it('accepts all severity values', () => {
    for (const s of ['info', 'warning', 'blocking']) {
      expect(() => ConstraintSchema.parse({ ...valid, severity: s })).not.toThrow();
    }
  });

  it('accepts all evaluation values', () => {
    for (const e of ['pass', 'warning', 'violation', 'unknown', 'requires_validation', 'error']) {
      expect(() => ConstraintSchema.parse({ ...valid, evaluation: e })).not.toThrow();
    }
  });

  it('rejects invalid category', () => {
    expect(() => ConstraintSchema.parse({ ...valid, category: 'aesthetic' })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = ConstraintSchema.parse(valid);
    expect(ConstraintSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
