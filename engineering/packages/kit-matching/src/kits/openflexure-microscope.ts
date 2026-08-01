import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const OPENFLEXURE_MICROSCOPE_KIT: PhysicalKitDefinition = {
  id: 'openflexure_microscope_research_bundle',
  name: 'OpenFlexure Microscope Research Bundle',
  description: 'Lab microscope and precision positioning platform',
  components: [
    { componentId: 'controller-esp32', quantity: 1, role: 'Main controller' },
    { componentId: 'mechanical-microscope-stage', quantity: 1, role: 'Translation stage' },
    { componentId: 'motor-stepper', quantity: 3, role: 'XYZ positioning motors' },
    { componentId: 'driver-stepper', quantity: 3, role: 'Motor drivers' },
    { componentId: 'camera-global-shutter', quantity: 1, role: 'Imaging sensor' },
    { componentId: 'battery-lipo-3s', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['lab-microscope'],
  applicableToolIds: ['T01', 'T03', 'T04', 'T08', 'T11', 'T12', 'T14'],
  requiredTools: ['Hex key set', 'Small Phillips screwdriver'],
  assemblySteps: [{ order: 1, instruction: 'Assemble flexure stage', cautions: ['Delicate plastic parts'] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'Focus test', expected: 'Image focuses smoothly' }],
  upgradeOptions: [],
  firmwareTarget: 'esp32',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
