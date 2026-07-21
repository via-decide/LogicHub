import { describe, it, expect } from 'vitest';
import { ValidationResultSchema } from '../src/index.js';

const valid = {
  id: 'vr-1',
  projectId: 'proj-1',
  revisionId: 'rev-1',
  validator: 'kicad-erc',
  validatorVersion: '8.0.0',
  validationType: 'erc' as const,
  status: 'pass' as const,
  startedAt: '2026-01-15T10:00:00+00:00',
  completedAt: '2026-01-15T10:00:05+00:00',
  durationMs: 5000,
  diagnostics: [],
  artifactIds: ['art-erc-1'],
  createdAt: '2026-01-15T10:00:05+00:00',
};

describe('ValidationResultSchema', () => {
  it('parses a valid result', () => {
    const result = ValidationResultSchema.parse(valid);
    expect(result.validationType).toBe('erc');
    expect(result.status).toBe('pass');
  });

  it('accepts all 9 validation types', () => {
    const types = ['schema', 'repository_integrity', 'kicad_import', 'erc', 'drc', 'bom', 'constraint', 'artifact_integrity', 'merge_gate'];
    for (const t of types) {
      expect(() => ValidationResultSchema.parse({ ...valid, validationType: t })).not.toThrow();
    }
  });

  it('accepts all 6 status values', () => {
    for (const s of ['pass', 'warning', 'fail', 'error', 'unknown', 'skipped']) {
      expect(() => ValidationResultSchema.parse({ ...valid, status: s })).not.toThrow();
    }
  });

  it('accepts diagnostics with all severity levels', () => {
    const withDiag = {
      ...valid,
      diagnostics: [
        { severity: 'error' as const, message: 'Missing net' },
        { severity: 'warning' as const, message: 'Unused pin', code: 'W001' },
        { severity: 'info' as const, message: 'Note' },
        { severity: 'hint' as const, message: 'Suggestion' },
      ],
    };
    expect(() => ValidationResultSchema.parse(withDiag)).not.toThrow();
  });

  it('rejects invalid validation type', () => {
    expect(() => ValidationResultSchema.parse({ ...valid, validationType: 'custom' })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = ValidationResultSchema.parse(valid);
    expect(ValidationResultSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
