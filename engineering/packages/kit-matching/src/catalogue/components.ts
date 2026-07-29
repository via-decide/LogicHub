import {
  UNKNOWN_COST,
  type PhysicalComponent,
  type SourcingRecord,
} from '../schemas/component.schema.js';

/**
 * Physical component catalogue for the first release.
 *
 * Every entry is UNSOURCED. The catalogue names generic part families that
 * are widely used and technically well defined — it does not name specific
 * purchasable products, and it carries no part numbers, supplier SKUs,
 * prices, or stock levels, because none have been sourced. Those fields
 * exist in the schema and stay null until a real supplier record is attached.
 *
 * Electrical envelopes are marked GENERIC_FAMILY: they are typical figures
 * for the family, adequate for feasibility arithmetic, and must be checked
 * against the datasheet of the specific part actually bought.
 */
const UNSOURCED: SourcingRecord = {
  state: 'UNSOURCED',
  manufacturerPartNumber: null,
  supplierSku: null,
  cost: UNKNOWN_COST,
  availability: 'UNKNOWN',
};

function component(entry: Omit<PhysicalComponent, 'sourcing'>): PhysicalComponent {
  return { ...entry, sourcing: { ...UNSOURCED } };
}

export const COMPONENT_CATALOGUE: readonly PhysicalComponent[] = [
  // ---------------------------------------------------------------- controllers
  component({
    id: 'controller-esp32',
    name: 'ESP32 development board',
    family: 'controller',
    partFamily: 'ESP32',
    satisfiesNodeType: 'controller',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 160, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: {
      'controller.present': true, 'compute.present': true,
      'wireless.bluetooth': true, 'wireless.wifi': true, 'wireless.any': true,
    },
    notes: 'Board-level supply range assumes an onboard regulator fed from VIN.',
  }),
  component({
    id: 'controller-rp2040',
    name: 'RP2040 development board',
    family: 'controller',
    partFamily: 'RP2040',
    satisfiesNodeType: 'controller',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 55, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'controller.present': true, 'compute.present': true },
    notes: 'No onboard radio. A separate connectivity component is required.',
  }),
  component({
    id: 'controller-rp2350',
    name: 'RP2350 development board',
    family: 'controller',
    partFamily: 'RP2350',
    satisfiesNodeType: 'controller',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 60, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'controller.present': true, 'compute.present': true },
    notes: 'No onboard radio. A separate connectivity component is required.',
  }),
  component({
    id: 'controller-esp32-camera',
    name: 'Camera-capable ESP32 board',
    family: 'controller',
    partFamily: 'ESP32',
    satisfiesNodeType: 'controller',
    electrical: {
      supplyVoltageMinV: 4.5, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 250, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: {
      'controller.present': true, 'compute.present': true, 'vision.present': true,
      'wireless.wifi': true, 'wireless.bluetooth': true, 'wireless.any': true,
    },
    notes: 'Camera capture draws appreciably more than a plain controller board.',
  }),

  // ------------------------------------------------------------------- drive
  component({
    id: 'driver-tb6612',
    name: 'TB6612-class dual motor driver',
    family: 'motor-driver',
    partFamily: 'TB6612FNG',
    satisfiesNodeType: null,
    electrical: {
      supplyVoltageMinV: 2.5, supplyVoltageMaxV: 13.5,
      typicalCurrentMa: 2, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'driver.h-bridge': true, 'driver.channels': 2 },
    notes: 'Two independent H-bridge channels; logic supply separate from motor supply.',
  }),
  component({
    id: 'motor-dc-gearbox',
    name: 'Low-voltage DC gearmotor',
    family: 'motor',
    partFamily: null,
    satisfiesNodeType: 'motor',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 6.0,
      typicalCurrentMa: 600, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'motor.count': 1, 'motion.present': true },
    notes: 'Current figure is a typical loaded draw, not a stall measurement.',
  }),
  component({
    id: 'actuator-micro-servo',
    name: 'Micro positional servo',
    family: 'actuator',
    partFamily: null,
    satisfiesNodeType: 'motor',
    electrical: {
      supplyVoltageMinV: 4.8, supplyVoltageMaxV: 6.0,
      typicalCurrentMa: 250, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'motor.count': 1, 'motion.present': true, 'motion.positional': true },
    notes: 'Integrated driver; needs a signal line rather than an H-bridge.',
  }),

  // ------------------------------------------------------------------- power
  component({
    id: 'battery-holder-3xaa',
    name: '3-cell AA battery holder',
    family: 'battery',
    partFamily: null,
    satisfiesNodeType: 'battery',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 4.8,
      typicalCurrentMa: 0, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'battery.present': true, 'power.available': true },
    notes: 'Range spans NiMH through alkaline cells. Holder only; cells not included.',
  }),
  component({
    id: 'battery-holder-4xaa',
    name: '4-cell AA battery holder',
    family: 'battery',
    partFamily: null,
    satisfiesNodeType: 'battery',
    electrical: {
      supplyVoltageMinV: 4.0, supplyVoltageMaxV: 6.4,
      typicalCurrentMa: 0, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'battery.present': true, 'power.available': true },
    notes: 'Holder only; cells not included.',
  }),
  component({
    id: 'battery-module-lowvoltage',
    name: 'Approved low-voltage battery module',
    family: 'battery',
    partFamily: null,
    satisfiesNodeType: 'battery',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 7.4,
      typicalCurrentMa: 0, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'battery.present': true, 'power.available': true },
    notes:
      'Module with integrated protection. Charging requires an approved reference '
      + 'design; this catalogue does not cover custom pack engineering.',
  }),

  // ----------------------------------------------------------------- sensors
  component({
    id: 'sensor-distance-ultrasonic',
    name: 'Ultrasonic distance sensor',
    family: 'sensor',
    partFamily: null,
    satisfiesNodeType: 'sensor',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 15, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'sensor.count': 1, 'sensor.distance': true, 'sensing.present': true },
    notes: 'Two GPIO lines: trigger and echo.',
  }),
  component({
    id: 'sensor-line-reflectance',
    name: 'Reflectance line sensor',
    family: 'sensor',
    partFamily: null,
    satisfiesNodeType: 'sensor',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 25, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'sensor.count': 1, 'sensor.line': true, 'sensing.present': true },
    notes: 'Analogue output; needs an ADC channel.',
  }),
  component({
    id: 'sensor-temp-humidity',
    name: 'Temperature and humidity sensor',
    family: 'sensor',
    partFamily: null,
    satisfiesNodeType: 'sensor',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 3, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: {
      'sensor.count': 1, 'sensor.temperature': true, 'sensor.humidity': true,
      'sensing.present': true,
    },
    notes: 'Digital interface.',
  }),
  component({
    id: 'sensor-light',
    name: 'Ambient light sensor',
    family: 'sensor',
    partFamily: null,
    satisfiesNodeType: 'sensor',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 2, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'sensor.count': 1, 'sensor.light': true, 'sensing.present': true },
    notes: '',
  }),
  component({
    id: 'sensor-soil-moisture',
    name: 'Soil-moisture sensor',
    family: 'sensor',
    partFamily: null,
    satisfiesNodeType: 'sensor',
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 8, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'sensor.count': 1, 'sensor.moisture': true, 'sensing.present': true },
    notes: 'Capacitive probes last longer than resistive ones in wet soil.',
  }),

  // ----------------------------------------------------------- interface I/O
  component({
    id: 'display-oled',
    name: 'Small OLED display module',
    family: 'display',
    partFamily: null,
    satisfiesNodeType: null,
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 20, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'display.present': true },
    notes: 'I2C interface.',
  }),
  component({
    id: 'input-tactile-button',
    name: 'Tactile button',
    family: 'input',
    partFamily: null,
    satisfiesNodeType: null,
    electrical: null,
    providesCapabilities: { 'input.button': true },
    notes: 'Passive; needs a pull-up or pull-down.',
  }),
  component({
    id: 'output-led-indicator',
    name: 'Indicator LED with series resistor',
    family: 'output',
    partFamily: null,
    satisfiesNodeType: null,
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 10, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'output.indicator': true },
    notes: '',
  }),
  component({
    id: 'output-piezo-speaker',
    name: 'Piezo speaker',
    family: 'output',
    partFamily: null,
    satisfiesNodeType: null,
    electrical: {
      supplyVoltageMinV: 3.0, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 30, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'output.audio': true },
    notes: '',
  }),
  component({
    id: 'actuator-relay-module',
    name: 'Low-voltage relay module',
    family: 'actuator',
    partFamily: null,
    satisfiesNodeType: null,
    electrical: {
      supplyVoltageMinV: 4.5, supplyVoltageMaxV: 5.5,
      typicalCurrentMa: 70, envelopeSource: 'GENERIC_FAMILY',
    },
    providesCapabilities: { 'actuator.switch': true },
    notes:
      'Switched side is restricted to low-voltage loads. Mains-voltage switching '
      + 'is out of scope for this release.',
  }),

  // ---------------------------------------------------------- connectivity
  component({
    id: 'connectivity-onboard-bluetooth',
    name: 'Onboard Bluetooth radio',
    family: 'connectivity',
    partFamily: null,
    satisfiesNodeType: 'connectivity',
    electrical: null,
    providesCapabilities: {
      'link.present': true, 'wireless.bluetooth': true, 'wireless.any': true,
    },
    notes: 'Provided by the controller silicon; not a separately fitted part.',
  }),
  component({
    id: 'connectivity-onboard-wifi',
    name: 'Onboard Wi-Fi radio',
    family: 'connectivity',
    partFamily: null,
    satisfiesNodeType: 'connectivity',
    electrical: null,
    providesCapabilities: { 'link.present': true, 'wireless.wifi': true, 'wireless.any': true },
    notes: 'Provided by the controller silicon; not a separately fitted part.',
  }),

  // ------------------------------------------------------------- mechanical
  component({
    id: 'mechanical-wheel-65mm',
    name: '65 mm wheel',
    family: 'mechanical',
    partFamily: null,
    satisfiesNodeType: null,
    electrical: null,
    providesCapabilities: { 'mechanical.wheel': true },
    notes: '',
  }),
  component({
    id: 'mechanical-chassis-2wd',
    name: 'Two-wheel-drive chassis plate',
    family: 'mechanical',
    partFamily: null,
    satisfiesNodeType: null,
    electrical: null,
    providesCapabilities: { 'mechanical.chassis': true },
    notes: '',
  }),
  component({
    id: 'mechanical-pan-tilt',
    name: 'Pan-and-tilt bracket',
    family: 'mechanical',
    partFamily: null,
    satisfiesNodeType: null,
    electrical: null,
    providesCapabilities: { 'mechanical.pan-tilt': true },
    notes: 'Takes two micro servos.',
  }),
  component({
    id: 'enclosure-prototype',
    name: 'Prototype enclosure set',
    family: 'enclosure',
    partFamily: null,
    satisfiesNodeType: null,
    electrical: null,
    providesCapabilities: { 'enclosure.present': true },
    notes: 'Prototype only. Carries no ingress, drop, or flammability rating.',
  }),
  component({
    id: 'wiring-jumper-set',
    name: 'Jumper wire set',
    family: 'wiring',
    partFamily: null,
    satisfiesNodeType: null,
    electrical: null,
    providesCapabilities: { 'wiring.present': true },
    notes: '',
  }),
];

const BY_ID = new Map(COMPONENT_CATALOGUE.map(c => [c.id, c]));

export function getComponent(id: string): PhysicalComponent | undefined {
  return BY_ID.get(id);
}

export function requireComponent(id: string): PhysicalComponent {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown component: ${id}`);
  return found;
}

/** Components that can stand behind a given ProductGraph node type. */
export function componentsForNodeType(nodeType: string): PhysicalComponent[] {
  return COMPONENT_CATALOGUE.filter(c => c.satisfiesNodeType === nodeType);
}
