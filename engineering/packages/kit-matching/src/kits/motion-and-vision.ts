import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

/** Kit 3 — Motion and Vision. A driven platform carrying a steerable camera. */
export const MOTION_AND_VISION_KIT: PhysicalKitDefinition = {
  id: 'motion-and-vision',
  name: 'Motion and Vision',
  description:
    'A driven platform with a pan-and-tilt camera head and forward distance sensing.',
  components: [
    { componentId: 'controller-esp32-camera', quantity: 1, role: 'Camera-capable controller' },
    { componentId: 'driver-tb6612', quantity: 1, role: 'Dual motor driver' },
    { componentId: 'motor-dc-gearbox', quantity: 2, role: 'Left and right drive motors' },
    { componentId: 'mechanical-wheel-65mm', quantity: 2, role: 'Drive wheels' },
    { componentId: 'mechanical-chassis-2wd', quantity: 1, role: 'Chassis plate' },
    { componentId: 'actuator-micro-servo', quantity: 2, role: 'Pan and tilt axes' },
    { componentId: 'mechanical-pan-tilt', quantity: 1, role: 'Camera head bracket' },
    { componentId: 'sensor-distance-ultrasonic', quantity: 2, role: 'Forward and rear sensing' },
    { componentId: 'battery-holder-4xaa', quantity: 1, role: 'Power source' },
    { componentId: 'connectivity-onboard-wifi', quantity: 1, role: 'Video and control link' },
    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['obstacle-avoider', 'educational-robot', 'camera-slider'],
  requiredTools: [
    'Small Phillips screwdriver',
    'Wire cutters',
    'Hex key set',
    'USB cable',
  ],
  assemblySteps: [
    {
      order: 1,
      instruction: 'Build the drive base: motors, wheels and chassis.',
      cautions: ['Keep fingers clear of the wheels once power is connected.'],
    },
    {
      order: 2,
      instruction: 'Assemble the pan-and-tilt bracket and fit both servos.',
      cautions: ['Centre each servo before fitting its horn, or the travel will be offset.'],
    },
    {
      order: 3,
      instruction: 'Mount the camera-capable controller to the head.',
      cautions: [],
    },
    {
      order: 4,
      instruction: 'Wire the drive motors, servos and both distance sensors.',
      cautions: [
        'Servos and camera capture together draw appreciably more than the drive '
        + 'motors alone; size the supply for the combined load.',
      ],
    },
    {
      order: 5,
      instruction: 'Connect the battery holder and flash the firmware.',
      cautions: ['Check polarity before connecting the holder.'],
    },
  ],
  testProcedure: [
    {
      order: 1,
      check: 'Sweep each servo across its full commanded range.',
      expected: 'Both axes move smoothly without binding or stalling at the limits.',
    },
    {
      order: 2,
      check: 'Raise the chassis and drive both motors in each direction.',
      expected: 'Both wheels turn in the commanded direction and stop on command.',
    },
    {
      order: 3,
      check: 'Measure the supply voltage while driving and panning at the same time.',
      expected: 'Voltage stays inside the controller input range under combined load.',
    },
  ],
  upgradeOptions: [
    {
      id: 'add-line-sensor',
      description: 'Add a reflectance line sensor for guided inspection runs.',
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
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
