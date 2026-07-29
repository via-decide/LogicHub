import { z } from 'zod';
import { QuantitySchema, OptionalQuantitySchema } from './quantity.schema.js';

/**
 * Per-rule input contracts. Every numeric is a Quantity with an explicit
 * unit. Nullable slots mean "may be declared unavailable" — the rules turn
 * null/absent into MissingInput records, never into zero.
 */

// ---------------------------------------------------------------------------
// SEC-POWER-THERMAL-001
// ---------------------------------------------------------------------------

export const PowerLoadSchema = z.object({
  name: z.string().min(1),
  rail: z.enum(['3V3', 'VBAT_SW']),
  current: QuantitySchema,
  duty: QuantitySchema,
  peakConcurrent: z.boolean().default(true),
});

export const RegulatorInputSchema = z.object({
  topology: z.enum(['linear-ldo', 'switching']),
  inputVoltage: QuantitySchema,
  outputVoltage: QuantitySchema,
  /** required for switching topology; null = unavailable */
  efficiency: OptionalQuantitySchema.optional(),
  /** null = unavailable */
  thermalResistance: OptionalQuantitySchema.optional(),
  thermalResistanceClass: z.enum(['measured', 'datasheet', 'estimated', 'unknown']),
});

export const PowerThermalInputsSchema = z.object({
  battery: z.object({
    nominalCapacity: QuantitySchema.nullable(),
    deratingFactor: QuantitySchema.nullable(),
    nominalVoltage: QuantitySchema.nullable(),
    dischargeLimit: QuantitySchema.nullable(),
  }),
  loads: z.array(PowerLoadSchema).min(1),
  regulator: RegulatorInputSchema,
  charger: z.object({
    programCurrent: OptionalQuantitySchema.optional(),
    chargingWhileOperating: z.boolean(),
    loadSharingEvidence: z.boolean().default(false),
  }),
  ambientTemperature: QuantitySchema.nullable(),
  maxComponentTemperature: QuantitySchema.nullable(),
  maxTouchTemperature: OptionalQuantitySchema.optional(),
  intendedDuration: QuantitySchema.nullable(),
  enclosureThermalResistanceClass: z.enum(['measured', 'datasheet', 'estimated', 'unknown']).default('unknown'),
});
export type PowerThermalInputs = z.infer<typeof PowerThermalInputsSchema>;

// ---------------------------------------------------------------------------
// SEC-OPTICAL-CLASSIFICATION-001
// ---------------------------------------------------------------------------

export const TokenClassSampleSchema = z.object({
  name: z.string().min(1),
  /** raw ADC strobe responses per channel, one entry per calibration sample */
  samplesR: z.array(z.number().finite()).min(1),
  samplesG: z.array(z.number().finite()).min(1),
  samplesB: z.array(z.number().finite()).min(1),
  tokenMaterial: z.string().optional(),
  filamentBatch: z.string().optional(),
  samplesEvidenceGrade: z.enum(['measured', 'estimated', 'unknown']).default('unknown'),
});

export const OpticalClassificationInputsSchema = z.object({
  adc: z.object({
    resolutionBits: QuantitySchema.nullable(),
    /** counts at which the channel is considered saturated */
    saturationCeiling: z.number().finite().nullable(),
  }),
  calibration: z.object({
    darkReading: z.number().finite().nullable(),
    ambientReading: z.number().finite().nullable(),
    /** ambient ceiling of the calibrated envelope, in counts */
    calibratedAmbientMax: z.number().finite().nullable(),
    normalizationReference: z.number().finite().nullable(),
    samplesPerClass: z.number().int().positive().nullable(),
  }),
  geometry: z.object({
    wellDepth: OptionalQuantitySchema.optional(),
    wellWallMaterial: z.string().optional(),
    colorPocketGeometry: z.string().optional(),
  }),
  timing: z.object({
    strobeSettlingTime: OptionalQuantitySchema.optional(),
    sampleInterval: OptionalQuantitySchema.optional(),
  }),
  ledBrightness: OptionalQuantitySchema.optional(),
  ldrDividerResistance: OptionalQuantitySchema.optional(),
  tokenClasses: z.array(TokenClassSampleSchema),
  /** optional single measurement to classify against the calibrated classes */
  measurement: z
    .object({
      R: z.number().finite(),
      G: z.number().finite(),
      B: z.number().finite(),
      dark: z.number().finite(),
      ambient: z.number().finite().nullable(),
    })
    .nullable()
    .optional(),
  thresholds: z.object({
    /** normalized-space distance beyond which a reading is unknown */
    unknownDistance: z.number().finite(),
    /** margin (d2 - d) below which a classification is ambiguous */
    ambiguityMargin: z.number().finite(),
    /** minimum acceptable inter-class separation vs within-class spread ratio */
    minSeparationToSpreadRatio: z.number().finite(),
  }),
});
export type OpticalClassificationInputs = z.infer<typeof OpticalClassificationInputsSchema>;

// ---------------------------------------------------------------------------
// SEC-INTERFACE-INTEGRITY-001
// ---------------------------------------------------------------------------

export const InterfacePinSchema = z.object({
  pin: z.string().min(1),
  function: z.string().min(1),
  direction: z.enum(['in', 'out', 'open-drain', 'analog-in', 'reserved', 'usb', 'power', 'ground']),
  voltageDomain: QuantitySchema.nullable(),
  strapping: z.boolean().default(false),
  approvedStrappingUse: z.string().optional(),
  sourceCurrent: OptionalQuantitySchema.optional(),
});

export const InterfaceConnectionSchema = z.object({
  id: z.string().min(1),
  fromPin: z.string().min(1),
  fromDirection: z.enum(['in', 'out', 'open-drain', 'analog-in', 'power', 'ground']),
  fromDomain: QuantitySchema.nullable(),
  toPin: z.string().min(1),
  toDirection: z.enum(['in', 'out', 'open-drain', 'analog-in', 'power', 'ground']),
  toDomain: QuantitySchema.nullable(),
  note: z.string().optional(),
});

export const InterfaceIntegrityInputsSchema = z.object({
  logicVoltage: QuantitySchema.nullable(),
  adcMaxInput: QuantitySchema.nullable(),
  gpioMaxSource: QuantitySchema.nullable(),
  pins: z.array(InterfacePinSchema).min(1),
  connections: z.array(InterfaceConnectionSchema),
  adcApplied: z.array(
    z.object({ pin: z.string().min(1), appliedVoltage: QuantitySchema.nullable() }),
  ),
  daughterboard: z.object({
    rail: z.string().min(1),
    maxLoad: QuantitySchema.nullable(),
    requestedLoad: QuantitySchema.nullable(),
    groundPins: z.number().int().nonnegative().nullable(),
    minGroundPins: z.number().int().positive().default(2),
    connectorKeyed: z.boolean().nullable(),
    connectorOrientationDefined: z.boolean().nullable(),
    mirroredInsertionPossible: z.boolean().nullable(),
    reservedPins: z.array(z.string()),
    reservedPinsUsed: z.array(z.string()),
    hotPlugClaim: z.boolean(),
    hotPlugSequencingEvidence: z.boolean().default(false),
    hotPlugInrushEvidence: z.boolean().default(false),
  }),
  protection: z.object({
    pptcHold: QuantitySchema.nullable(),
    pptcTrip: QuantitySchema.nullable(),
    downstreamDamageCurrent: OptionalQuantitySchema.optional(),
  }),
  exposedConductors: z.array(
    z.object({
      location: z.string().min(1),
      bare: z.boolean(),
      accessibleToStudents: z.boolean().nullable(),
    }),
  ),
});
export type InterfaceIntegrityInputs = z.infer<typeof InterfaceIntegrityInputsSchema>;

// ---------------------------------------------------------------------------
// SEC-MECHANICAL-RUGGEDNESS-001
// ---------------------------------------------------------------------------

export const MechanicalRuggednessInputsSchema = z.object({
  printer: z.object({
    type: z.string().min(1),
    envelopeX: QuantitySchema.nullable(),
    envelopeY: QuantitySchema.nullable(),
    envelopeZ: QuantitySchema.nullable(),
    nozzleDiameter: QuantitySchema.nullable(),
    layerHeight: QuantitySchema.nullable(),
  }),
  material: z.object({
    structural: z.enum(['PETG', 'PLA', 'ABS', 'ASA', 'PC']),
    diffuser: z.string().optional(),
    bumper: z.string().optional(),
  }),
  printOrientation: z.object({
    screwLoadAcrossLayers: z.boolean().nullable(),
    description: z.string().optional(),
  }),
  enclosure: z.object({
    largestPartX: QuantitySchema.nullable(),
    largestPartY: QuantitySchema.nullable(),
    largestPartZ: QuantitySchema.nullable(),
    wallThickness: QuantitySchema.nullable(),
    floorThickness: QuantitySchema.nullable(),
    minWallThicknessProcess: QuantitySchema.nullable(),
    minStructuralWallThickness: QuantitySchema.nullable(),
  }),
  diffuser: z.object({
    thickness: QuantitySchema.nullable(),
    minSupportableThickness: QuantitySchema.nullable(),
    blocked: z.boolean().nullable(),
  }),
  slate: z.object({
    width: QuantitySchema.nullable(),
    height: QuantitySchema.nullable(),
    thickness: QuantitySchema.nullable(),
    tolerance: QuantitySchema.nullable(),
    pocketWidth: QuantitySchema.nullable(),
    pocketHeight: QuantitySchema.nullable(),
    pocketDepth: QuantitySchema.nullable(),
    requiredRemovalClearance: QuantitySchema.nullable(),
    printTolerance: QuantitySchema.nullable(),
  }),
  token: z.object({
    diameter: QuantitySchema.nullable(),
    wellDiameter: QuantitySchema.nullable(),
    minClearance: QuantitySchema.nullable(),
    printTolerance: QuantitySchema.nullable(),
    wellDepth: QuantitySchema.nullable(),
    ambientLightBlocked: z.boolean().nullable(),
  }),
  fastening: z.object({
    screwDiameter: QuantitySchema.nullable(),
    bossOuterDiameter: QuantitySchema.nullable(),
    bossPilotDiameter: QuantitySchema.nullable(),
    minBossWall: QuantitySchema.nullable(),
    insertType: z.enum(['none', 'thread-forming', 'heat-set']).nullable(),
    expectedTorque: OptionalQuantitySchema.optional(),
  }),
  wiring: z.object({
    grooveWidth: QuantitySchema.nullable(),
    conductorDiameter: QuantitySchema.nullable(),
    minConductorSpacing: QuantitySchema.nullable(),
    actualConductorSpacing: QuantitySchema.nullable(),
    retentionWithoutGlue: z.boolean().nullable(),
    conductorsInsulated: z.boolean().nullable(),
  }),
  bumpers: z.object({
    geometryBlocksAssembly: z.boolean().nullable(),
  }),
  strap: z.object({
    anchorsPresent: z.boolean().nullable(),
    anchorLoadTested: z.boolean().default(false),
  }),
  product: z.object({
    expectedMass: QuantitySchema.nullable(),
    targetDropHeight: OptionalQuantitySchema.optional(),
    dropTested: z.boolean().default(false),
    assemblyClearance: QuantitySchema.nullable(),
  }),
});
export type MechanicalRuggednessInputs = z.infer<typeof MechanicalRuggednessInputsSchema>;

// ---------------------------------------------------------------------------
// SEC-MANUFACTURING-ECONOMICS-001
// ---------------------------------------------------------------------------

export const CostLineSchema = z.object({
  name: z.string().min(1),
  cost: QuantitySchema,
  category: z.enum(['electronics', 'module', 'mechanical', 'consumable', 'packaging', 'other']),
});

export const ManufacturingEconomicsInputsSchema = z.object({
  materialLines: z.array(CostLineSchema).min(1),
  filament: z.array(
    z.object({
      material: z.string().min(1),
      grams: QuantitySchema,
      pricePerKg: QuantitySchema,
    }),
  ),
  failedPrintAllowance: QuantitySchema.nullable(),
  printMachineHours: QuantitySchema.nullable(),
  printMachineRate: QuantitySchema.nullable(),
  assemblyHours: QuantitySchema.nullable(),
  laborRate: QuantitySchema.nullable(),
  assemblyConsumables: QuantitySchema.nullable(),
  packaging: QuantitySchema.nullable(),
  testingHours: QuantitySchema.nullable(),
  reworkAllowance: QuantitySchema.nullable(),
  scrapRate: QuantitySchema.nullable(),
  procurementVariance: QuantitySchema.nullable(),
  warrantyAllowance: QuantitySchema.nullable(),
  logisticsAllowance: QuantitySchema.nullable(),
  manufacturingOverhead: QuantitySchema.nullable(),
  targetExFactoryCost: QuantitySchema.nullable(),
  targetSellingPrice: QuantitySchema.nullable(),
  channelMargin: QuantitySchema.nullable(),
  taxTreatment: z.string().nullable(),
  productionQuantity: z.number().int().positive().nullable(),
});
export type ManufacturingEconomicsInputs = z.infer<typeof ManufacturingEconomicsInputsSchema>;
