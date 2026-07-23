import { describe, it, expect } from 'vitest';
import { CrossDomainEdgeSchema } from '../src/index.js';

const valid = {
  revisionId: 'rev-1',
  edgeType: 'dissipates_into' as const,
  sourceDomain: 'electrical' as const,
  targetDomain: 'thermal' as const,
  sourceRef: 'U1:LDO_3V3',
  targetRef: 'enclosure:main',
};

describe('CrossDomainEdgeSchema', () => {
  it('parses a valid edge', () => {
    const result = CrossDomainEdgeSchema.parse(valid);
    expect(result.edgeType).toBe('dissipates_into');
    expect(result.schemaVersion).toBe('0.1.0');
  });

  it('accepts all edge types', () => {
    const types = [
      'dissipates_into', 'mounts_to', 'mates_with', 'routes_through',
      'fastens_to', 'shields', 'conducts_heat', 'constrains_clearance',
    ] as const;
    for (const t of types) {
      expect(CrossDomainEdgeSchema.parse({ ...valid, edgeType: t }).edgeType).toBe(t);
    }
  });

  it('accepts all domain types', () => {
    const domains = ['electrical', 'mechanical', 'firmware', 'thermal'] as const;
    for (const d of domains) {
      expect(CrossDomainEdgeSchema.parse({ ...valid, sourceDomain: d }).sourceDomain).toBe(d);
    }
  });

  it('accepts optional object IDs and properties', () => {
    const result = CrossDomainEdgeSchema.parse({
      ...valid,
      sourceObjectId: 'eo-1',
      targetObjectId: 'eo-2',
      properties: { dissipation_watts: 6.96 },
    });
    expect(result.sourceObjectId).toBe('eo-1');
    expect(result.properties?.dissipation_watts).toBe(6.96);
  });

  it('rejects invalid edge type', () => {
    expect(() => CrossDomainEdgeSchema.parse({ ...valid, edgeType: 'depends_on' })).toThrow();
  });

  it('rejects invalid domain', () => {
    expect(() => CrossDomainEdgeSchema.parse({ ...valid, sourceDomain: 'chemical' })).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => CrossDomainEdgeSchema.parse({})).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = CrossDomainEdgeSchema.parse(valid);
    const roundtripped = CrossDomainEdgeSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(roundtripped).toEqual(parsed);
  });
});
