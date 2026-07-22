import { describe, it, expect } from 'vitest';
import { MechanicalManifestSchema, ConnectorSchema, FastenerSchema } from '../src/index.js';

const sha256 = 'a'.repeat(64);

const validManifest = {
  enclosure: {
    materialName: 'PETG',
    internalVolume: { value: 120, unit: 'cm3' as const },
    wallThickness: { value: 2.0, unit: 'mm' as const },
  },
  connectors: [{
    id: 'j1',
    designator: 'J1',
    family: 'jst_xh' as const,
    pinCount: 4,
    pinMap: [
      { pin: 1, net: 'VIN', description: '12V input' },
      { pin: 2, net: 'GND' },
    ],
  }],
  fasteners: [{
    id: 'f1',
    type: 'heat_set_insert' as const,
    bossOuterDiameter: { value: 6.0, unit: 'mm' as const },
    bossInnerDiameter: { value: 3.6, unit: 'mm' as const },
    bossDepth: { value: 5.0, unit: 'mm' as const },
    loadVector: { x: 0, y: 0, z: -1 },
    printLayerNormal: { x: 0, y: 0, z: 1 },
    perimeters: 4,
  }],
  evidenceRefs: [{ artifactHash: sha256, description: 'Enclosure CAD export' }],
};

describe('MechanicalManifestSchema', () => {
  it('parses a full manifest', () => {
    const result = MechanicalManifestSchema.parse(validManifest);
    expect(result.schemaVersion).toBe('0.1.0');
    expect(result.enclosure?.materialName).toBe('PETG');
    expect(result.connectors).toHaveLength(1);
    expect(result.fasteners).toHaveLength(1);
  });

  it('applies empty array defaults', () => {
    const result = MechanicalManifestSchema.parse({});
    expect(result.connectors).toEqual([]);
    expect(result.fasteners).toEqual([]);
    expect(result.evidenceRefs).toEqual([]);
    expect(result.enclosure).toBeUndefined();
  });

  it('rejects non-positive volume', () => {
    expect(() => MechanicalManifestSchema.parse({
      enclosure: {
        materialName: 'ABS',
        internalVolume: { value: 0, unit: 'cm3' },
        wallThickness: { value: 2, unit: 'mm' },
      },
    })).toThrow();
  });

  it('rejects invalid connector family', () => {
    expect(() => ConnectorSchema.parse({
      id: 'j1', designator: 'J1', family: 'banana_plug', pinCount: 1,
    })).toThrow();
  });

  it('rejects invalid fastener type', () => {
    expect(() => FastenerSchema.parse({
      id: 'f1', type: 'welded',
    })).toThrow();
  });

  it('rejects invalid evidence hash', () => {
    expect(() => MechanicalManifestSchema.parse({
      evidenceRefs: [{ artifactHash: 'tooshort', description: 'bad' }],
    })).toThrow();
  });

  it('roundtrips through JSON', () => {
    const parsed = MechanicalManifestSchema.parse(validManifest);
    const roundtripped = MechanicalManifestSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(roundtripped).toEqual(parsed);
  });
});
