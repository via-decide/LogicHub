import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const NASA_JPL_ROVER_KIT: PhysicalKitDefinition = {
  id: 'nasa_jpl_rover_openamrobot_research_bundle',
  name: 'NASA JPL Rover Research Bundle',
  description: 'Rover mechanics plus ROS2 AMR stack',
  components: [
    { componentId: 'controller-ros2', quantity: 1, role: 'High level compute' },
    { componentId: 'controller-esp32', quantity: 1, role: 'Low level motor control' },
    { componentId: 'motor-dc-gearbox', quantity: 6, role: 'Wheel drive motors' },
    { componentId: 'driver-tb6612', quantity: 3, role: 'Motor drivers' },
    { componentId: 'mechanical-wheel-65mm', quantity: 6, role: 'Drive wheels' },
    { componentId: 'battery-lipo-3s', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['ros2-amr-rover'],
  applicableToolIds: ['T01', 'T03', 'T04', 'T05', 'T08', 'T09', 'T10', 'T11', 'T12', 'T14'],
  requiredTools: ['Hex key set', 'Wire strippers'],
  assemblySteps: [{ order: 1, instruction: 'Assemble rocker-bogie suspension', cautions: ['Pinch hazard'] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'Teleop node', expected: 'Rover responds to ROS2 teleop commands' }],
  upgradeOptions: [],
  firmwareTarget: 'ros2',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
