import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseSchematic } from '../src/extractors/schematic-extractor.js';
import { parsePcb } from '../src/extractors/pcb-extractor.js';
import {
  sha256Hex, canonicalJson,
  schematicToObjects, pcbToObjects,
  type ExtractionContext,
} from '../src/extractors/engineering-objects.js';

const BASE_SCH = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/base/smart-plant-pot.kicad_sch');
const BASE_PCB = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/base/smart-plant-pot.kicad_pcb');

const ctx: ExtractionContext = {
  projectId: 'test-project',
  revisionId: 'test-revision-1',
  createdAt: '2025-01-01T00:00:00Z',
};

describe('sha256Hex', () => {
  it('produces 64-char hex', () => {
    const hash = sha256Hex('hello');
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
  });

  it('is deterministic', () => {
    expect(sha256Hex('test')).toBe(sha256Hex('test'));
  });

  it('differs for different inputs', () => {
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });
});

describe('canonicalJson', () => {
  it('sorts object keys', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('sorts nested object keys', () => {
    expect(canonicalJson({ z: { b: 1, a: 2 } })).toBe('{"z":{"a":2,"b":1}}');
  });

  it('preserves array order', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('is deterministic regardless of insertion order', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});

describe('engineering object hashing', () => {
  it('schematic objects have stable contentHash and semanticHash', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const objects1 = schematicToObjects(ctx, sch);
    const objects2 = schematicToObjects(ctx, sch);
    for (let i = 0; i < objects1.length; i++) {
      expect(objects1[i]!.contentHash).toBe(objects2[i]!.contentHash);
      expect(objects1[i]!.semanticHash).toBe(objects2[i]!.semanticHash);
    }
  });

  it('contentHash differs from semanticHash for objects with geometry', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const objects = schematicToObjects(ctx, sch);
    const withGeometry = objects.filter(o => o.geometry !== undefined);
    expect(withGeometry.length).toBeGreaterThan(0);
    for (const obj of withGeometry) {
      expect(obj.contentHash).not.toBe(obj.semanticHash);
    }
  });

  it('move-only change alters contentHash but not semanticHash', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const objects = schematicToObjects(ctx, sch);
    const j1 = objects.find(o => o.name === 'J1')!;

    const movedSch = { ...sch, symbols: sch.symbols.map(s =>
      s.reference === 'J1'
        ? { ...s, position: { x: s.position.x + 10, y: s.position.y, angle: s.position.angle } }
        : s,
    )};
    const movedObjects = schematicToObjects(ctx, movedSch);
    const j1Moved = movedObjects.find(o => o.name === 'J1')!;

    expect(j1Moved.semanticHash).toBe(j1.semanticHash);
    expect(j1Moved.contentHash).not.toBe(j1.contentHash);
  });

  it('value change alters both hashes', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const objects = schematicToObjects(ctx, sch);
    const c1 = objects.find(o => o.name === 'C1')!;

    const changedSch = { ...sch, symbols: sch.symbols.map(s =>
      s.reference === 'C1' ? { ...s, value: '22uF' } : s,
    )};
    const changedObjects = schematicToObjects(ctx, changedSch);
    const c1Changed = changedObjects.find(o => o.name === 'C1')!;

    expect(c1Changed.semanticHash).not.toBe(c1.semanticHash);
    expect(c1Changed.contentHash).not.toBe(c1.contentHash);
  });

  it('different revisionId produces different object IDs', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const objects1 = schematicToObjects(ctx, sch);
    const objects2 = schematicToObjects({ ...ctx, revisionId: 'different-revision' }, sch);

    expect(objects1[0]!.id).not.toBe(objects2[0]!.id);
  });

  it('pcb objects have valid hashes', async () => {
    const pcb = await parsePcb(BASE_PCB);
    const objects = pcbToObjects(ctx, pcb);
    for (const obj of objects) {
      expect(obj.contentHash).toHaveLength(64);
      expect(obj.semanticHash).toHaveLength(64);
      expect(obj.id).toMatch(/^eo-[a-f0-9]{24}$/);
    }
  });

  it('object IDs are deterministic', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const a = schematicToObjects(ctx, sch);
    const b = schematicToObjects(ctx, sch);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.id).toBe(b[i]!.id);
    }
  });
});
