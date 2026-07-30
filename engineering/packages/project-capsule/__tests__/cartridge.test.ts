import { describe, it, expect } from 'vitest';
import {
  W25Q64JV,
  planCartridgeLayout,
  estimateWear,
  type FlashDeviceProfile,
} from '../src/cartridge/cartridge-layout.js';
import { buildCapsule, capsuleByteSize } from '../src/build/capsule-builder.js';
import { roverGraph } from './helpers.js';

describe('W25Q64JV device profile', () => {
  it('describes the part as an 8 MB SPI NOR flash', () => {
    expect(W25Q64JV.capacityBytes).toBe(8 * 1024 * 1024);
    expect(W25Q64JV.capacityBytes).toBe(8_388_608);
    expect(W25Q64JV.interfaceType).toBe('spi');
  });

  it('records the programming and erase geometry', () => {
    expect(W25Q64JV.pageBytes).toBe(256);
    expect(W25Q64JV.sectorBytes).toBe(4096);
    expect(W25Q64JV.eraseCyclesPerSector).toBe(100_000);
  });

  it('records the supply range', () => {
    expect(W25Q64JV.supplyVoltageMinV).toBe(2.7);
    expect(W25Q64JV.supplyVoltageMaxV).toBe(3.6);
  });

  it('says the figures are datasheet values rather than measurements', () => {
    expect(W25Q64JV.figuresSource).toBe('DATASHEET');
  });
});

describe('Cartridge layout', () => {
  const capsule = buildCapsule(roverGraph());
  const layout = planCartridgeLayout(capsule);

  it('fits the Motion Starter capsule with room to spare', () => {
    expect(layout.fits).toBe(true);
    expect(layout.overflowBytes).toBeUndefined();
    expect(layout.headroomBytes).toBeGreaterThan(0);
  });

  it('lays every capsule file out on the device', () => {
    expect(layout.entries).toHaveLength(capsule.files.length);
    expect(layout.entries.map(e => e.path)).toEqual([...layout.entries.map(e => e.path)].sort());
  });

  it('starts every file on a sector boundary so it can be rewritten alone', () => {
    for (const entry of layout.entries) {
      expect(entry.offset % W25Q64JV.sectorBytes, entry.path).toBe(0);
    }
  });

  it('reports the slack that alignment costs rather than hiding it', () => {
    // A short file still occupies a whole 4 KB sector; that gap is real and
    // is the difference between fitting on paper and fitting on the part.
    expect(layout.occupiedBytes).toBeGreaterThan(layout.packedBytes);
    expect(layout.slackBytes).toBe(layout.occupiedBytes - layout.packedBytes);
    expect(layout.packedBytes).toBe(capsuleByteSize(capsule));
  });

  it('gives even a tiny file a whole sector', () => {
    const smallest = [...layout.entries].sort((a, b) => a.bytes - b.bytes)[0]!;
    expect(smallest.sectors).toBe(1);
    expect(smallest.slackBytes).toBe(W25Q64JV.sectorBytes - smallest.bytes);
  });

  it('counts the page writes each file needs', () => {
    for (const entry of layout.entries) {
      expect(entry.pageWrites).toBe(Math.max(1, Math.ceil(entry.bytes / W25Q64JV.pageBytes)));
    }
  });

  it('reports sector usage against what the device has', () => {
    expect(layout.sectorsAvailable).toBe(2048);
    expect(layout.sectorsUsed).toBe(layout.entries.reduce((n, e) => n + e.sectors, 0));
    expect(layout.sectorsUsed).toBeLessThan(layout.sectorsAvailable);
  });

  it('reports utilisation as a whole percent', () => {
    expect(Number.isInteger(layout.utilisationPercent)).toBe(true);
    expect(layout.utilisationPercent).toBeGreaterThanOrEqual(0);
    expect(layout.utilisationPercent).toBeLessThan(100);
  });

  it('explains that the capsule is carried data, not program space', () => {
    expect(layout.notes.join(' ')).toMatch(/not program space it executes from/);
  });

  it('fails closed on a device too small, and says by how much', () => {
    const tiny: FlashDeviceProfile = { ...W25Q64JV, id: 'tiny', capacityBytes: 8192 };
    const overflowed = planCartridgeLayout(capsule, tiny);

    expect(overflowed.fits).toBe(false);
    expect(overflowed.overflowBytes).toBeGreaterThan(0);
    expect(overflowed.headroomBytes).toBe(0);
  });

  it('does not suggest dropping content to make a capsule fit', () => {
    const tiny: FlashDeviceProfile = { ...W25Q64JV, id: 'tiny', capacityBytes: 8192 };
    const notes = planCartridgeLayout(capsule, tiny).notes.join(' ');
    expect(notes).toMatch(/Nothing may be dropped to force it/);
  });

  it('is deterministic', () => {
    const baseline = JSON.stringify(planCartridgeLayout(capsule));
    for (let i = 0; i < 5; i += 1) {
      expect(JSON.stringify(planCartridgeLayout(capsule))).toBe(baseline);
    }
  });
});

describe('Wear estimation', () => {
  it('reports remaining cycles against the rating', () => {
    const wear = estimateWear(W25Q64JV, 10_000);
    expect(wear.ratedCycles).toBe(100_000);
    expect(wear.cyclesRemaining).toBe(90_000);
  });

  it('projects remaining years only when a cadence is supplied', () => {
    expect(estimateWear(W25Q64JV, 0).estimatedYearsRemaining).toBeUndefined();
    expect(estimateWear(W25Q64JV, 0, 100).estimatedYearsRemaining).toBe(1000);
  });

  it('does not report negative life left on a worn part', () => {
    expect(estimateWear(W25Q64JV, 150_000).cyclesRemaining).toBe(0);
  });

  it('refuses to assume a fresh part when history is unknown', () => {
    // Assuming zero cycles used is exactly the assumption that ends in a worn
    // device being treated as new.
    expect(() => estimateWear(W25Q64JV, -1)).toThrow(/recorded non-negative count/);
    expect(() => estimateWear(W25Q64JV, 1.5)).toThrow(/recorded non-negative count/);
  });
});
