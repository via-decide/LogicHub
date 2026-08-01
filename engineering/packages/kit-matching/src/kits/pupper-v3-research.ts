import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const PUPPER_V3_RESEARCH_KIT: PhysicalKitDefinition = {
  id: 'pupper_v3_open_source_research_bundle',
  name: 'Pupper V3 Open Source Research Bundle',
  description: 'Quadruped robot kit/productization study',
  components: [
    { componentId: 'controller-esp32', quantity: 1, role: 'Main controller' },
    { componentId: 'mechanical-quadruped-chassis', quantity: 1, role: 'Legs and frame' },
    { componentId: 'actuator-micro-servo', quantity: 12, role: 'Joint actuators' },
    { componentId: 'battery-holder-4xaa', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['quadruped-robot'],
  applicableToolIds: ['T01', 'T03', 'T05', 'T08', 'T09', 'T10', 'T11', 'T12'],
  requiredTools: ['Hex key set', 'Small Phillips screwdriver'],
  assemblySteps: [{ order: 1, instruction: 'Assemble legs and calibrate servos', cautions: ['Pinch hazard on joints'] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'Stand up command', expected: 'Robot stands on all four legs' }],
  upgradeOptions: [],
  firmwareTarget: 'esp32',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
