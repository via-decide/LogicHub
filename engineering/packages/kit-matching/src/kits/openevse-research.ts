import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const OPENEVSE_RESEARCH_KIT: PhysicalKitDefinition = {
  id: 'openevse_research_bundle',
  name: 'OpenEVSE Research Bundle',
  description: 'Open EVSE charger platform and safety split',
  components: [
    { componentId: 'controller-esp32', quantity: 1, role: 'Main controller' },
    { componentId: 'sensor-current', quantity: 1, role: 'Current monitor' },
    { componentId: 'actuator-contactor', quantity: 1, role: 'High power relay' },
    { componentId: 'battery-holder-4xaa', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['evse-charger'],
  applicableToolIds: ['T01', 'T03', 'T05', 'T09', 'T10', 'T11', 'T12', 'T14'],
  requiredTools: ['Multimeter', 'Screwdriver'],
  assemblySteps: [{ order: 1, instruction: 'Assemble logic board and contactor', cautions: ['High voltage danger'] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'Simulate EV connection', expected: 'Contactor closes when EV requests charge' }],
  upgradeOptions: [],
  firmwareTarget: 'esp32',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
