import { describe, it, expect } from 'vitest';
import { ModuleSchema } from '../src/index.js';

const valid = {
  id: 'mod-1',
  namespace: 'via-decide',
  name: 'usb-c-pd',
  version: '1.0.0',
  description: 'USB-C Power Delivery module',
  interfaces: [],
  requirements: ['USB-C connector', 'PD controller IC'],
  constraints: [],
  dependencies: [],
  artifactIds: [],
  bomItemIds: [],
  maintainers: ['alice'],
  createdAt: '2026-01-15T10:00:00+00:00',
};

describe('ModuleSchema', () => {
  it('parses a valid module', () => {
    const result = ModuleSchema.parse(valid);
    expect(result.verificationStatus).toBe('unverified');
    expect(result.schemaVersion).toBe('0.1.0');
  });

  it('accepts all verification statuses', () => {
    for (const s of ['unverified', 'community', 'reviewed', 'validated', 'deprecated', 'revoked']) {
      expect(() => ModuleSchema.parse({ ...valid, verificationStatus: s })).not.toThrow();
    }
  });

  it('accepts dependencies', () => {
    const withDeps = {
      ...valid,
      dependencies: [{ moduleId: 'mod-2', versionConstraint: '^1.0.0' }],
    };
    expect(() => ModuleSchema.parse(withDeps)).not.toThrow();
  });

  it('rejects invalid verification status', () => {
    expect(() => ModuleSchema.parse({ ...valid, verificationStatus: 'certified' })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = ModuleSchema.parse(valid);
    expect(ModuleSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
