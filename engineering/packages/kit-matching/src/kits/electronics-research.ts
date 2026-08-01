import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const ELECTRONICS_RESEARCH_KIT: PhysicalKitDefinition = {
  id: 'electronics_research_bundle',
  name: 'Electronics Research Bundle',
  description: 'Foundation study: power electronics, embedded Linux, lab discipline',
  components: [
    { componentId: 'controller-linux', quantity: 1, role: 'Main controller' },
    { componentId: 'sensor-current', quantity: 1, role: 'Current monitor' },
    { componentId: 'battery-holder-4xaa', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['power-electronics-study'],
  applicableToolIds: ['T06', 'T10', 'T12', 'T14'],
  requiredTools: ['Multimeter', 'Oscilloscope'],
  assemblySteps: [{ order: 1, instruction: 'Assemble bench setup', cautions: [] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'Power on', expected: 'Boot to Linux prompt' }],
  upgradeOptions: [],
  firmwareTarget: 'linux',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
