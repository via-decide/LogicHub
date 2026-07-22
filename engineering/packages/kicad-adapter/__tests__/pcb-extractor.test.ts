import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parsePcb } from '../src/extractors/pcb-extractor.js';

const BASE_PCB = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/base/smart-plant-pot.kicad_pcb');

describe('parsePcb', () => {
  it('extracts PCB metadata', async () => {
    const pcb = await parsePcb(BASE_PCB);
    expect(pcb.version).toBe(20221018);
    expect(pcb.generator).toBe('pcbnew');
  });

  it('extracts nets', async () => {
    const pcb = await parsePcb(BASE_PCB);
    expect(pcb.nets.length).toBe(7);
    const namedNets = pcb.nets.filter(n => n.name.length > 0);
    expect(namedNets.length).toBe(6);
    const netNames = namedNets.map(n => n.name).sort();
    expect(netNames).toEqual(['+3V3', '+5V', 'GND', 'LED', 'LED_A', 'SENSE']);
  });

  it('extracts layers', async () => {
    const pcb = await parsePcb(BASE_PCB);
    const signalLayers = pcb.layers.filter(l => l.kind === 'signal');
    expect(signalLayers.length).toBe(2);
    expect(signalLayers.map(l => l.name).sort()).toEqual(['B.Cu', 'F.Cu']);
  });

  it('extracts footprints', async () => {
    const pcb = await parsePcb(BASE_PCB);
    expect(pcb.footprints.length).toBe(8);
    const refs = pcb.footprints.map(fp => fp.reference).sort();
    expect(refs).toEqual(['C1', 'C2', 'D1', 'J1', 'J2', 'R1', 'U1', 'U2']);
  });

  it('extracts footprint properties', async () => {
    const pcb = await parsePcb(BASE_PCB);
    const u1 = pcb.footprints.find(fp => fp.reference === 'U1');
    expect(u1).toBeDefined();
    expect(u1!.value).toBe('AMS1117-3.3');
    expect(u1!.libId).toBe('splp:SOT-223');
    expect(u1!.layer).toBe('F.Cu');
    expect(u1!.position).toEqual({ x: 50, y: 40, angle: 0 });
  });

  it('extracts pads with net assignments', async () => {
    const pcb = await parsePcb(BASE_PCB);
    const u1 = pcb.footprints.find(fp => fp.reference === 'U1')!;
    expect(u1.pads.length).toBe(3);
    const pad1 = u1.pads.find(p => p.number === '1')!;
    expect(pad1.netName).toBe('+5V');
    const pad3 = u1.pads.find(p => p.number === '3')!;
    expect(pad3.netName).toBe('+3V3');
  });

  it('extracts tracks', async () => {
    const pcb = await parsePcb(BASE_PCB);
    expect(pcb.tracks.length).toBe(15);
    expect(pcb.tracks.every(t => t.kind === 'segment')).toBe(true);
    expect(pcb.tracks.every(t => t.layer === 'F.Cu')).toBe(true);
    expect(pcb.tracks.every(t => t.width === 0.5)).toBe(true);
  });

  it('extracts track geometry', async () => {
    const pcb = await parsePcb(BASE_PCB);
    const track = pcb.tracks.find(t => t.start.x === 30 && t.start.y === 30)!;
    expect(track).toBeDefined();
    expect(track.end).toEqual({ x: 40, y: 30 });
    expect(track.netOrdinal).toBe(1);
  });

  it('has no vias in base fixture', async () => {
    const pcb = await parsePcb(BASE_PCB);
    expect(pcb.vias.length).toBe(0);
  });

  it('has no zones in base fixture', async () => {
    const pcb = await parsePcb(BASE_PCB);
    expect(pcb.zones.length).toBe(0);
  });

  it('extracts board outline', async () => {
    const pcb = await parsePcb(BASE_PCB);
    expect(pcb.outline.length).toBe(1);
    expect(pcb.outline[0]!.kind).toBe('gr_rect');
  });

  it('captures footprint UUIDs', async () => {
    const pcb = await parsePcb(BASE_PCB);
    for (const fp of pcb.footprints) {
      expect(fp.uuid).toBeTruthy();
      expect(fp.uuid.length).toBeGreaterThan(10);
    }
  });
});
