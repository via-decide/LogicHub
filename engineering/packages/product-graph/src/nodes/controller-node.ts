import {
  ControllerParamsSchema,
  type ControllerModel,
  type ControllerParams,
} from '../schemas/node-params.schema.js';
import {
  round,
  readNumber,
  type ConnectionSpec,
  type ConstraintResult,
  type MetricValue,
  type NodePlugin,
  type ParameterBound,
} from './node-plugin.js';

export interface ControllerProfile {
  gpioCount: number;
  ramKb: number;
  flashMb: number;
  adcChannels: number;
  pwmChannels: number;
  hasWifi: boolean;
  hasBle: boolean;
  operatingVoltageV: number;
  /** Absolute maximum on the chip's own logic rail. */
  absoluteMaxInputV: number;
  /** Input range a development board's onboard regulator accepts. */
  boardInputMinV: number;
  boardInputMaxV: number;
  maxClockMhz: number;
  idleCurrentMa: number;
  activeCurrentMa: number;
}

/**
 * Frozen controller profiles. These are nominal datasheet-typical figures used
 * for feasibility arithmetic; they are ESTIMATED, not measurements of any
 * specific board, and must be confirmed against the vendor datasheet for the
 * exact module before a physical build.
 */
export const CONTROLLER_PROFILES: Record<ControllerModel, ControllerProfile> = {
  esp32: {
    gpioCount: 34, ramKb: 520, flashMb: 4, adcChannels: 18, pwmChannels: 16,
    hasWifi: true, hasBle: true, operatingVoltageV: 3.3, absoluteMaxInputV: 3.6,
    boardInputMinV: 4.5, boardInputMaxV: 15.0,
    maxClockMhz: 240, idleCurrentMa: 20, activeCurrentMa: 160,
  },
  rp2040: {
    gpioCount: 30, ramKb: 264, flashMb: 2, adcChannels: 4, pwmChannels: 16,
    hasWifi: false, hasBle: false, operatingVoltageV: 3.3, absoluteMaxInputV: 3.6,
    boardInputMinV: 4.5, boardInputMaxV: 15.0,
    maxClockMhz: 133, idleCurrentMa: 18, activeCurrentMa: 55,
  },
  rp2350: {
    gpioCount: 30, ramKb: 520, flashMb: 4, adcChannels: 4, pwmChannels: 24,
    hasWifi: false, hasBle: false, operatingVoltageV: 3.3, absoluteMaxInputV: 3.6,
    boardInputMinV: 4.5, boardInputMaxV: 15.0,
    maxClockMhz: 150, idleCurrentMa: 20, activeCurrentMa: 60,
  },
  stm32f4: {
    gpioCount: 50, ramKb: 192, flashMb: 1, adcChannels: 16, pwmChannels: 20,
    hasWifi: false, hasBle: false, operatingVoltageV: 3.3, absoluteMaxInputV: 3.6,
    boardInputMinV: 4.5, boardInputMaxV: 15.0,
    maxClockMhz: 168, idleCurrentMa: 15, activeCurrentMa: 50,
  },
};

const CONNECTIONS: readonly ConnectionSpec[] = [
  { type: 'power', direction: 'in', label: 'Power in' },
  { type: 'control', direction: 'out', label: 'Control out' },
  { type: 'data', direction: 'in', label: 'Sensor in' },
  { type: 'data', direction: 'out', label: 'Telemetry out' },
];

const BOUNDS: readonly ParameterBound[] = [
  { parameter: 'controller', allowedValues: ['esp32', 'rp2040', 'rp2350', 'stm32f4'] },
];

export const ControllerNode: NodePlugin<ControllerParams> = {
  nodeType: 'controller',
  category: 'firmware',
  defaultParameters: ControllerParamsSchema.parse({}),

  parseParameters(raw) {
    return ControllerParamsSchema.parse(raw);
  },

  deriveMetrics(params) {
    const profile = CONTROLLER_PROFILES[params.controller];
    const usedGpio = Object.keys(params.assignedPins).length;
    const availableGpio = profile.gpioCount - usedGpio;

    return {
      model: params.controller,
      gpioCount: profile.gpioCount,
      usedGpio,
      availableGpio,
      ramKb: profile.ramKb,
      flashMb: profile.flashMb,
      adcChannels: profile.adcChannels,
      pwmChannels: profile.pwmChannels,
      // An H-bridge channel consumes two PWM outputs (speed + direction).
      supportedMotorChannels: Math.floor(profile.pwmChannels / 2),
      operatingVoltageV: profile.operatingVoltageV,
      absoluteMaxInputV: profile.absoluteMaxInputV,
      supplyEntry: params.supplyEntry,
      acceptedSupplyMinV: acceptedSupplyRange(params, profile).minV,
      acceptedSupplyMaxV: acceptedSupplyRange(params, profile).maxV,
      maxClockMhz: profile.maxClockMhz,
      activeCurrentMa: profile.activeCurrentMa,
      idleCurrentMa: profile.idleCurrentMa,
      hasWifi: profile.hasWifi,
      hasBle: profile.hasBle,
      powerLoadW: round((profile.operatingVoltageV * profile.activeCurrentMa) / 1000),
      // Declared for the board, not derived from the chip. Absent stays absent:
      // the thermal rule refuses to estimate a temperature without it, which is
      // the correct outcome rather than a gap to be filled with a plausible
      // number.
      regulatorThermalResistanceClass: params.regulatorThermalResistanceClass,
      ...(params.regulatorThermalResistanceKPerW === undefined
        ? {}
        : { regulatorThermalResistanceKPerW: params.regulatorThermalResistanceKPerW }),
      epistemicState: 'ESTIMATED',
    };
  },

  exposeCapabilities(params, metrics) {
    const profile = CONTROLLER_PROFILES[params.controller];
    return {
      'controller.present': true,
      'compute.present': true,
      'controller.gpioAvailable': metrics.availableGpio,
      'controller.pwmChannels': profile.pwmChannels,
      'controller.adcChannels': profile.adcChannels,
      'controller.motorChannels': metrics.supportedMotorChannels,
      'wireless.wifi': profile.hasWifi,
      'wireless.bluetooth': profile.hasBle,
      'wireless.any': profile.hasWifi || profile.hasBle,
    };
  },

  exposeRequirements(params, metrics) {
    const profile = CONTROLLER_PROFILES[params.controller];
    return {
      'power.voltageV': profile.operatingVoltageV,
      'power.maxInputV': profile.absoluteMaxInputV,
      'power.currentA': round(profile.activeCurrentMa / 1000),
      'power.loadW': metrics.powerLoadW,
    };
  },

  validate(params, ctx) {
    const results: ConstraintResult[] = [];
    const profile = CONTROLLER_PROFILES[params.controller];
    const usedGpio = Object.keys(params.assignedPins).length;

    if (usedGpio > profile.gpioCount) {
      results.push({
        code: 'controller.gpio-exhausted',
        severity: 'error',
        message: `${usedGpio} pins assigned but ${params.controller} exposes ${profile.gpioCount}.`,
      });
    }

    const supplyV = readNumber(ctx.upstream, 'power.voltageV');
    if (supplyV === undefined) {
      // No upstream supply resolved. Unknown is reported, never treated as pass.
      if (ctx.upstreamNodes.length > 0) {
        results.push({
          code: 'controller.supply-unknown',
          severity: 'warning',
          message: 'Upstream supply voltage is unknown; power compatibility is unverified.',
        });
      }
    } else {
      const accepted = acceptedSupplyRange(params, profile);
      if (round(supplyV) > round(accepted.maxV)) {
        results.push({
          code: 'controller.regulator-required',
          severity: 'error',
          message:
            `Supply is ${round(supplyV, 2)} V but ${params.controller} accepts at most ` +
            `${accepted.maxV} V at its ${accepted.label}. A regulator stage is required.`,
        });
      } else if (round(supplyV) < round(accepted.minV)) {
        results.push({
          code: 'controller.undervoltage',
          severity: 'error',
          message:
            `Supply is ${round(supplyV, 2)} V, below the ${accepted.minV} V this ` +
            `${params.controller} needs at its ${accepted.label}.`,
        });
      }
    }

    const duplicatePins = findDuplicatePins(params.assignedPins);
    for (const pin of duplicatePins) {
      results.push({
        code: 'controller.pin-conflict',
        severity: 'error',
        message: `Pin ${pin} is assigned to more than one function.`,
      });
    }

    return results;
  },

  acceptConnections() {
    return CONNECTIONS;
  },

  getSafeParameterBounds() {
    return BOUNDS;
  },
};

/**
 * The supply range that actually applies, which depends on where the supply
 * enters. Feeding a development board's input goes through its onboard
 * regulator and tolerates a wider range than the bare logic rail does.
 */
function acceptedSupplyRange(
  params: ControllerParams,
  profile: ControllerProfile,
): { minV: number; maxV: number; label: string } {
  return params.supplyEntry === 'board-vin'
    ? { minV: profile.boardInputMinV, maxV: profile.boardInputMaxV, label: 'board input' }
    : { minV: profile.operatingVoltageV, maxV: profile.absoluteMaxInputV, label: 'logic rail' };
}

function findDuplicatePins(assignedPins: Record<string, string>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const pin of Object.keys(assignedPins).sort()) {
    const target = assignedPins[pin];
    if (target === undefined) continue;
    if (seen.has(target)) duplicates.add(target);
    seen.add(target);
  }
  return [...duplicates].sort();
}
