import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseSchematic } from '../src/extractors/schematic-extractor.js';

const BASE_SCH = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/base/smart-plant-pot.kicad_sch');
const PROPOSED_SCH = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/proposed/smart-plant-pot.kicad_sch');

describe('parseSchematic', () => {
  it('extracts sheet metadata', async () => {
    const sch = await parseSchematic(BASE_SCH);
    expect(sch.version).toBe(20230121);
    expect(sch.generator).toBe('eeschema');
    expect(sch.uuid).toBeTruthy();
    expect(sch.sheetName).toContain('Smart Plant Pot');
  });

  it('extracts all symbols including power', async () => {
    const sch = await parseSchematic(BASE_SCH);
    expect(sch.symbols.length).toBeGreaterThan(0);
  });

  it('identifies non-power components', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const components = sch.symbols.filter(s => !s.isPower);
    const refs = components.map(s => s.reference).sort();
    expect(refs).toEqual(['C1', 'C2', 'D1', 'J1', 'J2', 'R1', 'U1', 'U2']);
  });

  it('identifies power symbols', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const power = sch.symbols.filter(s => s.isPower);
    expect(power.length).toBeGreaterThan(0);
    expect(power.every(s => s.reference.startsWith('#'))).toBe(true);
  });

  it('captures component properties', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const u1 = sch.symbols.find(s => s.reference === 'U1');
    expect(u1).toBeDefined();
    expect(u1!.value).toBe('AMS1117-3.3');
    expect(u1!.footprint).toBe('splp:SOT-223');
    expect(u1!.libId).toBe('splp:AMS1117-3.3');
    expect(u1!.inBom).toBe(true);
    expect(u1!.onBoard).toBe(true);
  });

  it('captures UUIDs', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const j1 = sch.symbols.find(s => s.reference === 'J1');
    expect(j1!.uuid).toBe('493d650d-8d15-401b-8a25-88bb54c2f91f');
  });

  it('captures geometry', async () => {
    const sch = await parseSchematic(BASE_SCH);
    const j1 = sch.symbols.find(s => s.reference === 'J1');
    expect(j1!.position).toEqual({ x: 40, y: 60, angle: 0 });
  });

  it('detects proposed changes', async () => {
    const base = await parseSchematic(BASE_SCH);
    const proposed = await parseSchematic(PROPOSED_SCH);

    const baseRefs = base.symbols.filter(s => !s.isPower).map(s => s.reference).sort();
    const proposedRefs = proposed.symbols.filter(s => !s.isPower).map(s => s.reference).sort();

    expect(baseRefs).not.toEqual(proposedRefs);
  });
});
