import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const FARMBOT_RESEARCH_KIT: PhysicalKitDefinition = {
  id: 'farmbot_open_source_research_bundle',
  name: 'FarmBot Open Source Research Bundle',
  description: 'Agriculture gantry robot and tool ecosystem',
  components: [
    { componentId: 'controller-esp32', quantity: 1, role: 'Main controller' },
    { componentId: 'mechanical-gantry', quantity: 1, role: 'Gantry hardware' },
    { componentId: 'motor-stepper', quantity: 3, role: 'Axis motors' },
    { componentId: 'driver-stepper', quantity: 3, role: 'Axis drivers' },
    { componentId: 'battery-lipo-3s', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['agriculture-gantry'],
  applicableToolIds: ['T01', 'T03', 'T04', 'T05', 'T08', 'T09', 'T11', 'T13'],
  requiredTools: ['Wrench set', 'Hex key set'],
  assemblySteps: [{ order: 1, instruction: 'Assemble gantry extrusions', cautions: ['Heavy assembly'] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'Home axes', expected: 'All axes home to zero position' }],
  upgradeOptions: [],
  firmwareTarget: 'farmduino',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
