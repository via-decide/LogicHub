import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const PRECIOUS_PLASTIC_ECOSYSTEM_KIT: PhysicalKitDefinition = {
  id: 'precious_plastic_machine_ecosystem_bundle',
  name: 'Precious Plastic Machine Ecosystem Bundle',
  description: 'Plastic recycling and small manufacturing machines',
  components: [
    { componentId: 'controller-esp32', quantity: 1, role: 'Process controller' },
    { componentId: 'mechanical-recycling-shredder', quantity: 1, role: 'Shredder mechanicals' },
    { componentId: 'actuator-contactor', quantity: 1, role: 'Heater/motor contactor' },
    { componentId: 'battery-lipo-3s', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['plastic-recycling-machine'],
  applicableToolIds: ['T01', 'T02', 'T03', 'T04', 'T05', 'T09', 'T10', 'T12', 'T13', 'T14'],
  requiredTools: ['Wrench set', 'Multimeter'],
  assemblySteps: [{ order: 1, instruction: 'Assemble shredder chassis and wire contactors', cautions: ['Pinch hazard', 'High voltage'] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'Dry run shredder', expected: 'Motor runs without binding' }],
  upgradeOptions: [],
  firmwareTarget: 'esp32',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
