import type { Measurement, MeasuredQuantity } from '../src/schemas/measurement.schema.js';
import { QUANTITY_UNITS } from '../src/measurement/comparison.js';
import type { EvidenceRecord, KitIdentity } from '../src/schemas/loop.schema.js';

export const FIXED_TIME = '2026-03-01T09:00:00.000Z';

export const IDENTITY: KitIdentity = {
  kitId: 'motion-starter',
  unitSerial: 'MS-000123',
  hardwareRevision: 'hw-a',
};

/**
 * Build a measurement with full provenance. Test fixtures still carry every
 * provenance field, because a reading without one is not a measurement.
 */
export function measurement(
  quantity: MeasuredQuantity,
  value: number,
  overrides: Partial<Measurement> = {},
): Measurement {
  return {
    id: `m_${quantity}`,
    quantity,
    value,
    unit: QUANTITY_UNITS[quantity],
    nodeId: null,
    recordedAt: FIXED_TIME,
    recordedBy: 'test-technician',
    instrument: 'bench multimeter',
    environment: { ambientTemperatureC: 21, surface: 'bench', notes: '' },
    evidenceRef: `ev_${quantity}`,
    unitSerial: IDENTITY.unitSerial,
    hardwareRevision: 'hw-a',
    firmwareRevision: 'fw-1.0.0',
    ...overrides,
  };
}

export function evidence(ref: string): EvidenceRecord {
  return {
    ref,
    kind: 'photo',
    description: `Evidence for ${ref}`,
    capturedAt: FIXED_TIME,
    capturedBy: 'test-technician',
    sha256: 'a'.repeat(64),
  };
}
