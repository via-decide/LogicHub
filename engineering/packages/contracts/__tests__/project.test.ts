import { describe, it, expect } from 'vitest';
import { ProjectSchema } from '../src/index.js';

const valid = {
  id: 'proj-1',
  slug: 'smart-plant-pot',
  name: 'Smart Plant Pot',
  description: 'An automated plant monitoring board',
  visibility: 'private' as const,
  repository: { provider: 'github', localPath: '/repos/spp', defaultBranch: 'main' },
  defaultBranch: 'main',
  createdBy: 'alice',
  createdAt: '2026-01-15T10:00:00+00:00',
  status: 'active' as const,
};

describe('ProjectSchema', () => {
  it('parses a valid project', () => {
    const result = ProjectSchema.parse(valid);
    expect(result.id).toBe('proj-1');
    expect(result.schemaVersion).toBe('0.1.0');
    expect(result.status).toBe('active');
  });

  it('applies defaults for schemaVersion and status', () => {
    const { schemaVersion, status, ...rest } = valid;
    const result = ProjectSchema.parse(rest);
    expect(result.schemaVersion).toBe('0.1.0');
    expect(result.status).toBe('active');
  });

  it('rejects missing required fields', () => {
    expect(() => ProjectSchema.parse({})).toThrow();
    expect(() => ProjectSchema.parse({ id: 'x' })).toThrow();
  });

  it('rejects invalid visibility', () => {
    expect(() => ProjectSchema.parse({ ...valid, visibility: 'secret' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => ProjectSchema.parse({ ...valid, status: 'deleted' })).toThrow();
  });

  it('rejects invalid slug format', () => {
    expect(() => ProjectSchema.parse({ ...valid, slug: 'Has Spaces' })).toThrow();
    expect(() => ProjectSchema.parse({ ...valid, slug: '' })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = ProjectSchema.parse(valid);
    const roundtripped = ProjectSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(roundtripped).toEqual(parsed);
  });

  it('accepts optional fields omitted', () => {
    const { description, ...rest } = valid;
    const result = ProjectSchema.parse(rest);
    expect(result.description).toBeUndefined();
  });

  it('accepts all visibility values', () => {
    for (const v of ['public', 'private', 'organization'] as const) {
      expect(ProjectSchema.parse({ ...valid, visibility: v }).visibility).toBe(v);
    }
  });
});
