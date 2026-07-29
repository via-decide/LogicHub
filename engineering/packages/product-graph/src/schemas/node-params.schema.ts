import { z } from 'zod';

export const BatteryChemistrySchema = z.enum(['lipo', 'liion', 'nimh', 'alkaline']);
export type BatteryChemistry = z.infer<typeof BatteryChemistrySchema>;

export const BatteryParamsSchema = z.object({
  chemistry: BatteryChemistrySchema.default('lipo'),
  cellCount: z.number().int().min(1).max(6).default(3),
  capacityMah: z.number().positive().default(2200),
  dischargeRating: z.number().positive().default(25),
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
