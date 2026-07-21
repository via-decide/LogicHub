import { describe, it, expect } from 'vitest';
import { DecisionSchema } from '../src/index.js';

const valid = {
  id: 'dec-1',
  projectId: 'proj-1',
  revisionId: 'rev-1',
  question: 'Which voltage regulator to use?',
  alternatives: [
    { id: 'alt-1', description: 'AMS1117-3.3' },
    { id: 'alt-2', description: 'AP2112K-3.3', tradeoffs: 'Lower quiescent current' },
  ],
  selectedAlternative: 'alt-2',
  rationale: 'Lower power consumption in sleep mode',
  constraintsConsidered: ['con-1'],
  evidenceArtifactIds: [],
  validationResultIds: [],
  confidence: 'high' as const,
  createdBy: 'alice',
  createdAt: '2026-01-15T10:00:00+00:00',
};

describe('DecisionSchema', () => {
  it('parses a valid decision', () => {
    const result = DecisionSchema.parse(valid);
    expect(result.status).toBe('proposed');
    expect(result.confidence).toBe('high');
  });

  it('accepts all status values', () => {
    for (const s of ['proposed', 'accepted', 'rejected', 'superseded']) {
      expect(() => DecisionSchema.parse({ ...valid, status: s })).not.toThrow();
    }
  });

  it('rejects invalid status', () => {
    expect(() => DecisionSchema.parse({ ...valid, status: 'pending' })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = DecisionSchema.parse(valid);
    expect(DecisionSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
