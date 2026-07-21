import { describe, it, expect } from 'vitest';
import { EngineeringObjectSchema } from '../src/index.js';

const sha = 'b'.repeat(64);
const valid = {
  id: 'eo-1',
  projectId: 'proj-1',
  revisionId: 'rev-1',
  objectType: 'component' as const,
  sourcePath: 'main.kicad_sch',
  name: 'U1',
  semanticKey: 'power.regulator.main',
  properties: { value: '3.3V', package: 'SOT-23' },
  relationships: [{ type: 'powered_by' as const, targetId: 'eo-2' }],
  geometry: { x: 100, y: 200 },
  contentHash: sha,
  semanticHash: sha,
  createdAt: '2026-01-15T10:00:00+00:00',
};

describe('EngineeringObjectSchema', () => {
  it('parses a valid engineering object', () => {
    const result = EngineeringObjectSchema.parse(valid);
    expect(result.objectType).toBe('component');
    expect(result.semanticKey).toBe('power.regulator.main');
  });

  it('accepts all 20 object types', () => {
    const types = [
      'project', 'schematic_sheet', 'symbol', 'component', 'net', 'pin',
      'interface', 'pcb', 'footprint', 'pad', 'track', 'via', 'zone',
      'layer', 'board_outline', 'bom_item', 'test_point', 'document',
      'firmware_interface', 'module_instance',
    ];
    for (const t of types) {
      expect(() => EngineeringObjectSchema.parse({ ...valid, objectType: t })).not.toThrow();
    }
  });

  it('rejects invalid objectType', () => {
    expect(() => EngineeringObjectSchema.parse({ ...valid, objectType: 'widget' })).toThrow();
  });

  it('rejects invalid hash format', () => {
    expect(() => EngineeringObjectSchema.parse({ ...valid, contentHash: 'short' })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = EngineeringObjectSchema.parse(valid);
    expect(EngineeringObjectSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
