import { byteLength } from '../canonical/hashing.js';
import { comparePaths, type Capsule } from '../schemas/capsule.schema.js';

/**
 * A flash device a capsule can be written to.
 *
 * Geometry matters because NOR flash is not a filesystem: it programs in pages
 * and erases in sectors, so a capsule's fit depends on how its files land on
 * those boundaries rather than on their total size alone.
 */
export interface FlashDeviceProfile {
  id: string;
  partFamily: string;
  capacityBytes: number;
  /** Smallest programmable unit. */
  pageBytes: number;
  /** Smallest erasable unit. */
  sectorBytes: number;
  /** Rated erase/program cycles, per sector. */
  eraseCyclesPerSector: number;
  supplyVoltageMinV: number;
  supplyVoltageMaxV: number;
  interfaceType: 'spi';
  /**
   * Where the figures came from. DATASHEET means published values for the part
   * family, which still want confirming against the revision actually ordered.
   */
  figuresSource: 'DATASHEET' | 'MEASURED';
}

/**
 * Winbond W25Q64JV — 64 Mbit (8 MB) SPI NOR flash.
 *
 * This is the offline carrier the capsule format's 8 MB target was written
 * against. It sits beside the controller: an 8-bit MCU cannot address this as
 * program space, so the capsule is data the host reads, not code the MCU runs.
 */
export const W25Q64JV: FlashDeviceProfile = {
  id: 'w25q64jv',
  partFamily: 'W25Q64JV',
  capacityBytes: 8 * 1024 * 1024,
  pageBytes: 256,
  sectorBytes: 4096,
  eraseCyclesPerSector: 100_000,
  supplyVoltageMinV: 2.7,
  supplyVoltageMaxV: 3.6,
  interfaceType: 'spi',
  figuresSource: 'DATASHEET',
};

export interface FileLayoutEntry {
  path: string;
  bytes: number;
  /** Byte offset where this file starts. Sector-aligned. */
  offset: number;
  sectors: number;
  /** Program operations needed to write it. */
  pageWrites: number;
  /** Bytes lost to sector alignment on this file. */
  slackBytes: number;
}

export interface CartridgeLayout {
  device: FlashDeviceProfile;
  /** True only when everything fits with its alignment accounted for. */
  fits: boolean;
  entries: FileLayoutEntry[];
  /** Sum of file sizes, ignoring geometry. */
  packedBytes: number;
  /** What the device actually consumes once files are sector-aligned. */
  occupiedBytes: number;
  slackBytes: number;
  sectorsUsed: number;
  sectorsAvailable: number;
  headroomBytes: number;
  /** Whole percent of the device consumed. */
  utilisationPercent: number;
  /** Present only when it could be computed; never a stand-in figure. */
  overflowBytes?: number;
  notes: string[];
}

/**
 * Plan where a capsule's files land on a flash device.
 *
 * Files are laid out sector-aligned so any one of them can be erased and
 * rewritten without disturbing its neighbours. That costs slack — a 100-byte
 * file still occupies a 4 KB sector — and the cost is reported rather than
 * hidden, because it is the difference between a capsule that fits on paper
 * and one that fits on the part.
 */
export function planCartridgeLayout(
  capsule: Capsule,
  device: FlashDeviceProfile = W25Q64JV,
): CartridgeLayout {
  const files = [...capsule.files].sort((a, b) => comparePaths(a.path, b.path));

  const entries: FileLayoutEntry[] = [];
  let offset = 0;
  let packedBytes = 0;

  for (const file of files) {
    const bytes = byteLength(file.content);
    const sectors = Math.max(1, Math.ceil(bytes / device.sectorBytes));
    const occupied = sectors * device.sectorBytes;

    entries.push({
      path: file.path,
      bytes,
      offset,
      sectors,
      pageWrites: Math.max(1, Math.ceil(bytes / device.pageBytes)),
      slackBytes: occupied - bytes,
    });

    offset += occupied;
    packedBytes += bytes;
  }

  const occupiedBytes = offset;
  const sectorsUsed = occupiedBytes / device.sectorBytes;
  const sectorsAvailable = Math.floor(device.capacityBytes / device.sectorBytes);
  const fits = occupiedBytes <= device.capacityBytes;

  const notes = [
    `Files are sector-aligned to ${device.sectorBytes} bytes so each can be rewritten `
    + 'independently.',
    `Programming happens in ${device.pageBytes}-byte pages; erasing in `
    + `${device.sectorBytes}-byte sectors.`,
    'The capsule is data carried beside the controller, not program space it executes from.',
  ];

  if (!fits) {
    notes.push('This capsule does not fit. Nothing may be dropped to force it — see the '
      + 'capsule format note on not excluding required source or evidence to meet a size '
      + 'target.');
  }

  return {
    device,
    fits,
    entries,
    packedBytes,
    occupiedBytes,
    slackBytes: occupiedBytes - packedBytes,
    sectorsUsed,
    sectorsAvailable,
    headroomBytes: Math.max(0, device.capacityBytes - occupiedBytes),
    utilisationPercent: Math.round((occupiedBytes / device.capacityBytes) * 100),
    ...(fits ? {} : { overflowBytes: occupiedBytes - device.capacityBytes }),
    notes,
  };
}

export interface WearEstimate {
  /** Rated cycles for the sector under consideration. */
  ratedCycles: number;
  cyclesUsed: number;
  cyclesRemaining: number;
  /** Present only when a rewrite cadence was supplied. */
  estimatedYearsRemaining?: number;
}

/**
 * How much write life is left in a sector.
 *
 * `cyclesUsed` must come from a real counter kept by whatever does the
 * writing. There is no default: a device whose history is unknown returns an
 * error rather than an optimistic figure, because assuming a fresh part is
 * exactly the assumption that ends in a worn one.
 */
export function estimateWear(
  device: FlashDeviceProfile,
  cyclesUsed: number,
  rewritesPerYear?: number,
): WearEstimate {
  if (!Number.isInteger(cyclesUsed) || cyclesUsed < 0) {
    throw new Error('cyclesUsed must be a recorded non-negative count, not an assumption.');
  }

  const cyclesRemaining = Math.max(0, device.eraseCyclesPerSector - cyclesUsed);

  return {
    ratedCycles: device.eraseCyclesPerSector,
    cyclesUsed,
    cyclesRemaining,
    ...(rewritesPerYear !== undefined && rewritesPerYear > 0
      ? { estimatedYearsRemaining: Math.floor(cyclesRemaining / rewritesPerYear) }
      : {}),
  };
}
