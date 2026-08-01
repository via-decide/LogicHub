import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

/** Kit 2 — Environment Starter. Stationary sensing and low-voltage switching. */
export const ENVIRONMENT_STARTER_KIT: PhysicalKitDefinition = {
  id: 'environment-starter',
  name: 'Environment Starter',
  description:
    'A stationary sensing station that reports environmental readings and can '
    + 'switch a low-voltage load.',
  components: [
    { componentId: 'controller-esp32', quantity: 1, role: 'Main controller' },
    { componentId: 'sensor-temp-humidity', quantity: 1, role: 'Temperature and humidity' },
    { componentId: 'sensor-light', quantity: 1, role: 'Ambient light' },
    { componentId: 'sensor-soil-moisture', quantity: 1, role: 'Soil moisture' },
    { componentId: 'display-oled', quantity: 1, role: 'Local readout' },
    { componentId: 'actuator-relay-module', quantity: 1, role: 'Low-voltage load switching' },
    { componentId: 'battery-holder-4xaa', quantity: 1, role: 'Power source' },
    { componentId: 'connectivity-onboard-wifi', quantity: 1, role: 'Network link' },
    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: [
    'greenhouse-monitor',
    'irrigation-controller',
    'room-monitor',
  ],
  applicableToolIds: ['T01', 'T03', 'T10', 'T12', 'T14'],
  requiredTools: ['Small Phillips screwdriver', 'Wire strippers', 'USB cable'],
  assemblySteps: [
    {
      order: 1,
      instruction: 'Wire the temperature, light and moisture sensors to the controller.',
      cautions: [],
    },
    {
      order: 2,
      instruction: 'Connect the display to the I2C lines shared with the sensors.',
      cautions: ['Two devices cannot share an I2C address; check before wiring.'],
    },
    {
      order: 3,
      instruction: 'Wire the relay module control line and its supply.',
      cautions: [
        'The switched side is for low-voltage loads only.',
        'Mains-voltage switching is out of scope and must not be attempted with this kit.',
      ],
    },
    {
      order: 4,
      instruction: 'Connect the battery holder and flash the firmware.',
      cautions: ['Check polarity before connecting the holder.'],
    },
  ],
  testProcedure: [
    {
      order: 1,
      check: 'Compare the reported temperature against a separate thermometer.',
      expected: 'Readings agree within the sensor tolerance stated by its datasheet.',
    },
    {
      order: 2,
      check: 'Cover the light sensor.',
      expected: 'Reported light level falls.',
    },
    {
      order: 3,
      check: 'Command the relay on and off with no load attached.',
      expected: 'The relay audibly actuates in both directions.',
    },
  ],
  upgradeOptions: [
    {
      id: 'swap-controller-rp2350',
      description:
        'Replace the ESP32 with an RP2350. A connectivity component must be added, '
        + 'since the RP2350 has no onboard radio.',
      replacesComponentId: 'controller-esp32',
      withComponentId: 'controller-rp2350',
      requiresRecalculation: true,
    },
    {
      id: 'upgrade-battery-module',
      description:
        'Replace the AA holder with an approved low-voltage battery module. The module '
        + 'sits above the sensor supply range, so a regulator stage must be added with it.',
      replacesComponentId: 'battery-holder-4xaa',
      withComponentId: 'battery-module-lowvoltage',
      requiresRecalculation: true,
    },
    {
      id: 'add-enclosure',
      description: 'Add a prototype enclosure set for outdoor siting.',
      replacesComponentId: null,
      withComponentId: 'enclosure-prototype',
      requiresRecalculation: true,
    },
  ],
  firmwareTarget: 'esp32',
  assemblyDifficulty: 'beginner',
  validationStatus: 'UNVALIDATED',
};
