import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

/**
 * Kit 1 — Motion Starter.
 *
 * The vertical slice the platform is built around: battery, controller,
 * driver, two motors, a distance sensor and a Bluetooth link, driven from a
 * generated operator app.
 */
export const MOTION_STARTER_KIT: PhysicalKitDefinition = {
  id: 'motion-starter',
  name: 'Motion Starter',
  description:
    'A two-motor ground vehicle with distance sensing and a short-range link, '
    + 'assembled from low-voltage parts.',
  components: [
    { componentId: 'controller-esp32', quantity: 1, role: 'Main controller' },
    { componentId: 'driver-tb6612', quantity: 1, role: 'Dual motor driver' },
    { componentId: 'motor-dc-gearbox', quantity: 2, role: 'Left and right drive motors' },
    { componentId: 'mechanical-wheel-65mm', quantity: 2, role: 'Drive wheels' },
    { componentId: 'mechanical-chassis-2wd', quantity: 1, role: 'Chassis plate' },
    { componentId: 'battery-holder-4xaa', quantity: 1, role: 'Power source' },
    { componentId: 'sensor-distance-ultrasonic', quantity: 1, role: 'Forward distance sensing' },
    { componentId: 'connectivity-onboard-bluetooth', quantity: 1, role: 'Operator link' },
    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: [
    'bluetooth-rover',
    'line-follower',
    'obstacle-avoider',
    'camera-slider',
    'conveyor-controller',
  ],
  applicableToolIds: ['T01', 'T03', 'T05', 'T08', 'T10', 'T12'],
  requiredTools: ['Small Phillips screwdriver', 'Wire cutters', 'USB cable'],
  assemblySteps: [
    {
      order: 1,
      instruction: 'Mount both gearmotors to the chassis plate and fit the wheels.',
      cautions: ['Keep fingers clear of the wheels once power is connected.'],
    },
    {
      order: 2,
      instruction: 'Mount the controller and motor driver to the chassis.',
      cautions: [],
    },
    {
      order: 3,
      instruction: 'Wire the driver motor outputs to the two motors.',
      cautions: ['Confirm polarity before powering; reversed leads reverse that wheel.'],
    },
    {
      order: 4,
      instruction: 'Wire the battery holder to the driver motor supply and the controller input.',
      cautions: [
        'Check polarity twice. Reverse polarity can destroy the controller.',
        'Leave the battery disconnected until every other connection is made.',
      ],
    },
    {
      order: 5,
      instruction: 'Fit the distance sensor facing forward and wire its trigger and echo lines.',
      cautions: [],
    },
    {
      order: 6,
      instruction: 'Flash the firmware over USB with the battery disconnected.',
      cautions: ['Do not power from USB and the battery at the same time.'],
    },
  ],
  testProcedure: [
    {
      order: 1,
      check: 'Measure the pack voltage at the controller input before first power-on.',
      expected: 'Within the controller board input range printed in its documentation.',
    },
    {
      order: 2,
      check: 'Raise the chassis so the wheels spin free, then command each motor forward.',
      expected: 'Each wheel turns forward independently and stops on command.',
    },
    {
      order: 3,
      check: 'Place an obstacle at a known distance and read the sensor.',
      expected: 'Reported distance tracks the measured distance.',
    },
    {
      order: 4,
      check: 'Connect the operator app and command a stop while the motors run.',
      expected: 'Both motors stop.',
    },
  ],
  upgradeOptions: [
    {
      id: 'swap-controller-rp2350',
      description:
        'Replace the ESP32 with an RP2350. The RP2350 has no onboard radio, so a '
        + 'connectivity component must be added to keep the operator link.',
      replacesComponentId: 'controller-esp32',
      withComponentId: 'controller-rp2350',
      requiresRecalculation: true,
    },
    {
      id: 'upgrade-battery-module',
      description: 'Replace the AA holder with an approved low-voltage battery module.',
      replacesComponentId: 'battery-holder-4xaa',
      withComponentId: 'battery-module-lowvoltage',
      requiresRecalculation: true,
    },
    {
      id: 'add-line-sensor',
      description: 'Add a reflectance line sensor to enable line-following products.',
      replacesComponentId: null,
      withComponentId: 'sensor-line-reflectance',
      requiresRecalculation: true,
    },
    {
      id: 'add-enclosure',
      description: 'Add a prototype enclosure set.',
      replacesComponentId: null,
      withComponentId: 'enclosure-prototype',
      requiresRecalculation: true,
    },
  ],
  firmwareTarget: 'esp32',
  assemblyDifficulty: 'beginner',
  validationStatus: 'UNVALIDATED',
};
