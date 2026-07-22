import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseSchematic } from '../src/extractors/schematic-extractor.js';
import { extractBom } from '../src/extractors/bom-extractor.js';

const BASE_SCH = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/base/smart-plant-pot.kicad_sch');
const PROPOSED_SCH = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/proposed/smart-plant-pot.kicad_sch');

describe('extractBom', () => {
  it('groups components by value+footprint', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const bom = extractBom(sch);
    expect(bom.length).toBeGreaterThan(0);
    for (const item of bom) {
      expect(item.quantity).toBe(item.references.length);
    }
  });

  it('excludes power symbols', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const bom = extractBom(sch);
    const allRefs = bom.flatMap(b => b.references);
    expect(allRefs.every(r => !r.startsWith('#'))).toBe(true);
  });

  it('produces sorted references', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const bom = extractBom(sch);
    for (const item of bom) {
      const sorted = [...item.references].sort();
      expect(item.references).toEqual(sorted);
    }
  });

  it('produces sorted output', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const bom = extractBom(sch);
    for (let i = 1; i < bom.length; i++) {
      const prev = bom[i - 1]!.value + bom[i - 1]!.footprint;
      const curr = bom[i]!.value + bom[i]!.footprint;
      expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
    }
  });

  it('base and proposed BOMs differ', async () => {
    const baseSch = await parseSchematic(BASE_SCH);
    const proposedSch = await parseSchematic(PROPOSED_SCH);
    const baseBom = extractBom(baseSch);
    const proposedBom = extractBom(proposedSch);

    const baseValues = baseBom.map(b => b.value).sort();
    const proposedValues = proposedBom.map(b => b.value).sort();
    expect(baseValues).not.toEqual(proposedValues);
  });

  it('captures libId', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const bom = extractBom(sch);
    for (const item of bom) {
      expect(item.libId).toBeTruthy();
    }
  });
});
