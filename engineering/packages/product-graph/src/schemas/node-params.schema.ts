import { z } from 'zod';

export const BatteryChemistrySchema = z.enum(['lipo', 'liion', 'nimh', 'alkaline']);
export type BatteryChemistry = z.infer<typeof BatteryChemistrySchema>;

export const BatteryParamsSchema = z.object({
  chemistry: BatteryChemistrySchema.default('lipo'),
  cellCount: z.number().int().min(1).max(6).default(3),
  capacityMah: z.number().positive().default(2200),
  // A pack added with these defaults must satisfy the explore-mode bounds this
  // same plugin publishes, or a beginner's first node is invalid the moment it
  // appears. 2200 mAh at 8C is 17.6 A, inside the 20 A explore ceiling.
  dischargeRating: z.number().positive().default(8),
});
export type BatteryParams = z.infer<typeof BatteryParamsSchema>;

export const ControllerModelSchema = z.enum(['esp32', 'rp2040', 'rp2350', 'stm32f4']);
export type ControllerModel = z.infer<typeof ControllerModelSchema>;

/**
 * Where the supply enters the controller.
 *
 * direct-3v3 — the regulated logic rail is fed directly, so the chip's own
 *              absolute maximum applies.
 * board-vin  — the supply enters a development board's input and passes
 *              through its onboard regulator, which tolerates a wider range.
 */
export const SupplyEntrySchema = z.enum(['direct-3v3', 'board-vin']);
export type SupplyEntry = z.infer<typeof SupplyEntrySchema>;

export const ControllerParamsSchema = z.object({
  controller: ControllerModelSchema.default('esp32'),
  supplyEntry: SupplyEntrySchema.default('direct-3v3'),
  assignedPins: z.record(z.string(), z.string()).default({}),
  enabledPeripherals: z.array(z.string()).default([]),
  /**
   * Junction-to-ambient thermal resistance of the board's onboard regulator,
   * in K/W. That regulator is the part whose temperature the power rule
   * estimates, and its figure depends on the board layout rather than the chip,
   * so it is absent until someone declares it for the board in hand.
   */
  regulatorThermalResistanceKPerW: z.number().positive().optional(),
  regulatorThermalResistanceClass: z
    .enum(['measured', 'datasheet', 'estimated', 'unknown'])
    .default('unknown'),
});
export type ControllerParams = z.infer<typeof ControllerParamsSchema>;

export const MotorTypeSchema = z.enum(['dc-brushed', 'servo', 'stepper']);
export type MotorType = z.infer<typeof MotorTypeSchema>;

export const MotorParamsSchema = z.object({
  motorType: MotorTypeSchema.default('dc-brushed'),
  ratedVoltageV: z.number().positive().default(6),
  noLoadRpm: z.number().positive().default(200),
  stallTorqueNcm: z.number().positive().default(8),
  stallCurrentA: z.number().positive().default(1.5),
  gearRatio: z.number().positive().default(1),
  wheelDiameterMm: z.number().positive().default(65),
});
export type MotorParams = z.infer<typeof MotorParamsSchema>;

export const DriverFamilySchema = z.enum(['h-bridge', 'stepper-driver', 'low-side-switch']);
export type DriverFamily = z.infer<typeof DriverFamilySchema>;

/**
 * Grade of the thermal resistance figure, matching the vocabulary the
 * validation engine already uses.
 *
 * There is no default of 'estimated'. A junction-to-ambient figure nobody
 * supplied is 'unknown', and unknown must reach the reader as unknown rather
 * than as a plausible number of unstated origin.
 */
export const ThermalResistanceClassSchema = z.enum([
  'measured', 'datasheet', 'estimated', 'unknown',
]);
export type ThermalResistanceClass = z.infer<typeof ThermalResistanceClassSchema>;

/**
 * A motor driver stage.
 *
 * Defaults describe a TB6612-class dual H-bridge, which is the part the Motion
 * Starter kit already lists. The R_DS(on) default is the datasheet typical for
 * one side of a channel at 25 degC; real conduction loss depends on die
 * temperature, so this is arithmetic for sizing, not a measurement.
 */
export const DriverParamsSchema = z.object({
  driverFamily: DriverFamilySchema.default('h-bridge'),
  channels: z.number().int().min(1).max(8).default(2),
  rdsOnMilliohm: z.number().positive().default(500),
  logicVoltageV: z.number().positive().default(3.3),
  supplyVoltageMinV: z.number().positive().default(2.5),
  supplyVoltageMaxV: z.number().positive().default(13.5),
  maxContinuousCurrentA: z.number().positive().default(1.2),
  quiescentCurrentMa: z.number().nonnegative().default(2),
  /**
   * Junction-to-ambient thermal resistance, in K/W. Optional, and absent by
   * default: the package this rides on is not known from the part alone.
   */
  thermalResistanceKPerW: z.number().positive().optional(),
  thermalResistanceClass: ThermalResistanceClassSchema.default('unknown'),
});
export type DriverParams = z.infer<typeof DriverParamsSchema>;

export const SensorTypeSchema = z.enum([
  'distance', 'line', 'temperature', 'light', 'imu', 'moisture',
]);
export type SensorType = z.infer<typeof SensorTypeSchema>;

export const SensorParamsSchema = z.object({
  sensorType: SensorTypeSchema.default('distance'),
  interfaceType: z.enum(['gpio', 'adc', 'i2c', 'spi', 'uart']).default('gpio'),
  currentDrawMa: z.number().nonnegative().default(15),
});
export type SensorParams = z.infer<typeof SensorParamsSchema>;

export const ConnectivityTypeSchema = z.enum(['bluetooth', 'wifi', 'radio']);
export type ConnectivityType = z.infer<typeof ConnectivityTypeSchema>;

export const ConnectivityParamsSchema = z.object({
  connectivityType: ConnectivityTypeSchema.default('bluetooth'),
  rangeMEstimate: z.number().positive().default(10),
});
export type ConnectivityParams = z.infer<typeof ConnectivityParamsSchema>;

export const OperatorAppParamsSchema = z.object({
  appName: z.string().default('Operator'),
});
export type OperatorAppParams = z.infer<typeof OperatorAppParamsSchema>;
