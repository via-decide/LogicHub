import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

/** Kit 4 — Product Interface. A handheld console: display, controls and sound. */
export const PRODUCT_INTERFACE_KIT: PhysicalKitDefinition = {
  id: 'product-interface',
  name: 'Product Interface',
  description:
    'A handheld console with a display, buttons, indicators and sound, built to '
    + 'explore product interfaces rather than motion.',
  components: [
    { componentId: 'controller-rp2350', quantity: 1, role: 'Main controller' },
    { componentId: 'display-oled', quantity: 1, role: 'Primary readout' },
    { componentId: 'input-tactile-button', quantity: 4, role: 'Navigation and select' },
    { componentId: 'output-led-indicator', quantity: 2, role: 'Status indicators' },
    { componentId: 'output-piezo-speaker', quantity: 1, role: 'Audible feedback' },
    { componentId: 'sensor-light', quantity: 1, role: 'Ambient light sensing' },
    { componentId: 'sensor-temp-humidity', quantity: 1, role: 'Environmental readout' },
    { componentId: 'connectivity-onboard-bluetooth', quantity: 1, role: 'Companion link' },
    { componentId: 'battery-holder-4xaa', quantity: 1, role: 'Power source' },
    { componentId: 'enclosure-prototype', quantity: 1, role: 'Handheld shell' },
    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['room-monitor', 'portable-diagnostic'],
  requiredTools: ['Soldering iron', 'Small Phillips screwdriver', 'Wire strippers', 'USB cable'],
  assemblySteps: [
    {
      order: 1,
      instruction: 'Fit the display, buttons, LEDs and speaker to the enclosure front.',
      cautions: ['Check the fit before soldering; the panel cutouts are not adjustable later.'],
    },
    {
      order: 2,
      instruction: 'Wire the buttons to controller inputs with pull-ups enabled in firmware.',
      cautions: [],
    },
    {
      order: 3,
      instruction: 'Wire the display and environmental sensors to the shared I2C lines.',
      cautions: ['Two devices cannot share an I2C address; check before wiring.'],
    },
    {
      order: 4,
      instruction: 'Fit the battery holder and close the enclosure.',
      cautions: [
        'Check polarity before connecting the holder.',
        'The prototype enclosure carries no ingress, drop, or flammability rating.',
      ],
    },
  ],
  testProcedure: [
    {
      order: 1,
      check: 'Press each button in turn.',
      expected: 'Each press registers exactly once, with no repeats from contact bounce.',
    },
    {
      order: 2,
      check: 'Render a known test pattern to the display.',
      expected: 'The full pattern appears with no missing rows or columns.',
    },
    {
      order: 3,
      check: 'Command a tone and each indicator LED.',
      expected: 'The tone sounds and both LEDs light on command.',
    },
  ],
  upgradeOptions: [
    {
      id: 'swap-controller-esp32',
      description:
        'Replace the RP2350 with an ESP32 to gain onboard Wi-Fi alongside Bluetooth.',
      replacesComponentId: 'controller-rp2350',
      withComponentId: 'controller-esp32',
      requiresRecalculation: true,
    },
    {
      id: 'upgrade-battery-module',
      description: 'Replace the AA holder with an approved low-voltage battery module.',
      replacesComponentId: 'battery-holder-4xaa',
      withComponentId: 'battery-module-lowvoltage',
      requiresRecalculation: true,
    },
  ],
  firmwareTarget: 'rp2350',
  assemblyDifficulty: 'intermediate',
  validationStatus: 'UNVALIDATED',
};
