import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const DRONE_CAD_IMPLEMENTATION_KIT: PhysicalKitDefinition = {
  id: 'drone_cad_implementation_bundle',
  name: 'Drone CAD Implementation Bundle',
  description: 'Flight-controller EVT and tether validation',
  components: [
    { componentId: 'controller-flight', quantity: 1, role: 'Flight controller' },
    { componentId: 'motor-dc-gearbox', quantity: 4, role: 'Rotors (simulated with DC)' },
    { componentId: 'driver-tb6612', quantity: 2, role: 'Motor driver' },
    { componentId: 'battery-lipo-3s', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['quadcopter-drone'],
  applicableToolIds: ['T01', 'T03', 'T05', 'T08', 'T09', 'T10', 'T12', 'T14'],
  requiredTools: ['Hex key set', 'Wire cutters'],
  assemblySteps: [{ order: 1, instruction: 'Assemble frame and motors', cautions: ['Propellers can cause injury'] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'Arm motors', expected: 'Motors spin up evenly' }],
  upgradeOptions: [],
  firmwareTarget: 'px4',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
