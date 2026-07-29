import { describe, it, expect } from 'vitest';
import { ArtifactSchema, type ArtifactRole } from '../src/index.js';

const sha = 'a'.repeat(64);
const valid = {
  id: 'art-1',
  projectId: 'proj-1',
  revisionId: 'rev-1',
  role: 'schematic_render' as ArtifactRole,
  filename: 'schematic.svg',
  mediaType: 'image/svg+xml',
  byteSize: 12345,
  sha256: sha,
  storageKey: `artifacts/${sha}`,
  sourcePaths: ['main.kicad_sch'],
  generatedBy: 'kicad-cli',
  generatorVersion: '8.0.0',
  createdAt: '2026-01-15T10:00:00+00:00',
};

describe('ArtifactSchema', () => {
  it('parses a valid artifact', () => {
    const result = ArtifactSchema.parse(valid);
    expect(result.sha256).toBe(sha);
    expect(result.schemaVersion).toBe('0.1.0');
  });

  it('rejects invalid sha256', () => {
    expect(() => ArtifactSchema.parse({ ...valid, sha256: 'not-a-hash' })).toThrow();
  });

  it('rejects negative byteSize', () => {
    expect(() => ArtifactSchema.parse({ ...valid, byteSize: -1 })).toThrow();
  });

  it('rejects invalid role', () => {
    expect(() => ArtifactSchema.parse({ ...valid, role: 'invalid_role' })).toThrow();
  });

  it('accepts all 14 roles', () => {
    const roles = [
      'source', 'schematic_render', 'pcb_render', 'visual_diff', 'structural_diff',
      'bom', 'bom_diff', 'erc_report', 'drc_report', 'constraint_report',
      'validation_report', 'decision_export', 'revision_manifest', 'review_report',
    ];
    for (const role of roles) {
      expect(() => ArtifactSchema.parse({ ...valid, role })).not.toThrow();
    }
  });

  it('roundtrips through JSON', () => {
    const parsed = ArtifactSchema.parse(valid);
    expect(ArtifactSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
