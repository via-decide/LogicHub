import type { ProductTemplate } from '../schemas/discovery.schema.js';

/**
 * Product templates describe what a configuration would need to become a given
 * product. They are feasibility descriptions only — matching a template says
 * the capability arithmetic works out, not that anything has been built,
 * tested, certified, or shown to be safe for any particular user.
 */
export const PRODUCT_TEMPLATES: readonly ProductTemplate[] = [
  {
    id: 'bluetooth-rover',
    name: 'Bluetooth Rover',
    description: 'A two-motor ground vehicle driven from a phone over a short-range link.',
    difficulty: 'beginner',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'motor.count', operator: 'gte', value: 2, weight: 1, required: true },
      { capability: 'wireless.bluetooth', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [
      { capability: 'sensor.distance', operator: 'eq', value: true, weight: 0.5, required: false },
      { capability: 'app.present', operator: 'exists', value: true, weight: 0.5, required: false },
    ],
  },
  {
    id: 'line-follower',
    name: 'Line Follower',
    description: 'A vehicle that tracks a contrasting line using reflectance sensors.',
    difficulty: 'beginner',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'motor.count', operator: 'gte', value: 2, weight: 1, required: true },
      { capability: 'sensor.line', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [
      { capability: 'motor.speedMps', operator: 'lte', value: 1, weight: 0.5, required: false },
    ],
  },
  {
    id: 'obstacle-avoider',
    name: 'Obstacle Avoider',
    description: 'A vehicle that steers around what it detects in front of it.',
    difficulty: 'beginner',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'motor.count', operator: 'gte', value: 2, weight: 1, required: true },
      { capability: 'sensor.distance', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [
      { capability: 'wireless.any', operator: 'eq', value: true, weight: 0.5, required: false },
    ],
  },
  {
    id: 'educational-robot',
    name: 'Educational Robot',
    description: 'A general-purpose teaching platform with motion, sensing and a remote link.',
    difficulty: 'intermediate',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'motor.count', operator: 'gte', value: 2, weight: 1, required: true },
      { capability: 'sensing.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'wireless.any', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [
      { capability: 'app.present', operator: 'exists', value: true, weight: 0.5, required: false },
      { capability: 'battery.runtimeH', operator: 'gte', value: 1, weight: 0.5, required: false },
    ],
  },
  {
    id: 'camera-slider',
    name: 'Camera Slider',
    description: 'A single-axis motion rig that moves a camera at a controlled rate.',
    difficulty: 'intermediate',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'motor.count', operator: 'gte', value: 1, weight: 1, required: true },
      { capability: 'motor.speedMps', operator: 'lte', value: 0.5, weight: 1, required: true },
    ],
    optionalCapabilities: [
      { capability: 'wireless.any', operator: 'eq', value: true, weight: 0.5, required: false },
    ],
  },
  {
    id: 'conveyor-controller',
    name: 'Conveyor Controller',
    description: 'A continuously driven belt with a start/stop control surface.',
    difficulty: 'intermediate',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'motor.count', operator: 'gte', value: 1, weight: 1, required: true },
      { capability: 'motor.torqueNcm', operator: 'gte', value: 10, weight: 1, required: true },
    ],
    optionalCapabilities: [
      { capability: 'sensor.distance', operator: 'eq', value: true, weight: 0.5, required: false },
    ],
  },
  {
    id: 'greenhouse-monitor',
    name: 'Greenhouse Monitor',
    description: 'A stationary logger reporting environmental readings over a network link.',
    difficulty: 'beginner',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'sensor.temperature', operator: 'eq', value: true, weight: 1, required: true },
      { capability: 'wireless.any', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [
      { capability: 'sensor.light', operator: 'eq', value: true, weight: 0.5, required: false },
      { capability: 'battery.runtimeH', operator: 'gte', value: 12, weight: 0.5, required: false },
    ],
  },
  {
    id: 'irrigation-controller',
    name: 'Irrigation Controller',
    description: 'A scheduled valve driver with moisture-informed watering.',
    difficulty: 'intermediate',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'motor.count', operator: 'gte', value: 1, weight: 1, required: true },
      { capability: 'sensing.present', operator: 'exists', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [
      { capability: 'wireless.wifi', operator: 'eq', value: true, weight: 0.5, required: false },
    ],
  },
  {
    id: 'room-monitor',
    name: 'Room Monitor',
    description: 'A desk device showing light, temperature and motion in one place.',
    difficulty: 'beginner',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'sensor.count', operator: 'gte', value: 2, weight: 1, required: true },
    ],
    optionalCapabilities: [
      { capability: 'wireless.any', operator: 'eq', value: true, weight: 0.5, required: false },
      { capability: 'app.present', operator: 'exists', value: true, weight: 0.5, required: false },
    ],
  },
  {
    id: 'portable-diagnostic',
    name: 'Portable Diagnostic',
    description: 'A handheld readout that samples a signal and reports it to a phone.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.adcChannels', operator: 'gte', value: 4, weight: 1, required: true },
      { capability: 'sensing.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'wireless.bluetooth', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [
      { capability: 'battery.runtimeH', operator: 'gte', value: 4, weight: 0.5, required: false },
      { capability: 'app.present', operator: 'exists', value: true, weight: 0.5, required: false },
    ],
  },
  
  // --- New Research Bundle Templates ---

  {
    id: 'power-electronics-study',
    name: 'Power Electronics Study',
    description: 'A bench setup for analyzing power delivery and switching.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'sensing.present', operator: 'exists', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'quadcopter-drone',
    name: 'Quadcopter Drone',
    description: 'A four-rotor flying vehicle.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'quadruped-robot',
    name: 'Quadruped Robot',
    description: 'A four-legged walking robot.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'mechanical.chassis', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'agriculture-gantry',
    name: 'Agriculture Gantry',
    description: 'A multi-axis gantry for precise farming operations.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'mechanical.chassis', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'lab-microscope',
    name: 'Lab Microscope',
    description: 'An automated or assisted microscopy platform.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'mechanical.chassis', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'satellite-ground-station',
    name: 'Satellite Ground Station',
    description: 'A receiver for downlinking satellite telemetry.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'link.present', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'corexy-3d-printer',
    name: 'CoreXY 3D Printer',
    description: 'A high-speed precision manufacturing tool.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'mechanical.chassis', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'evse-charger',
    name: 'EVSE Charger',
    description: 'An electric vehicle supply equipment controller.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'actuator.switch', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'local-vision-appliance',
    name: 'Local Vision Appliance',
    description: 'A smart camera running local inference.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'vision.present', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'riscv-edge-compute',
    name: 'RISC-V Edge Compute',
    description: 'A high-performance RISC-V application board.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'plastic-recycling-machine',
    name: 'Plastic Recycling Machine',
    description: 'A mechanical processor for waste plastics.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'mechanical.chassis', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
  {
    id: 'ros2-amr-rover',
    name: 'ROS2 AMR Rover',
    description: 'An autonomous mobile robot running ROS2.',
    difficulty: 'advanced',
    requiredCapabilities: [
      { capability: 'power.available', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'controller.present', operator: 'exists', value: true, weight: 1, required: true },
      { capability: 'motion.present', operator: 'eq', value: true, weight: 1, required: true },
    ],
    optionalCapabilities: [],
  },
];
