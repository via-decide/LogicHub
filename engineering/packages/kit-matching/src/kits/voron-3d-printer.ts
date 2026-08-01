import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const VORON_3D_PRINTER_KIT: PhysicalKitDefinition = {
  id: 'voron_3d_printer_engineering_bundle',
  name: 'Voron 3D Printer Engineering Bundle',
  description: 'CoreXY 3D printer engineering and kit QA',
  components: [
    { componentId: 'controller-linux', quantity: 1, role: 'Main controller' },
    { componentId: 'mechanical-corexy', quantity: 1, role: 'CoreXY mechanics' },
    { componentId: 'motor-stepper', quantity: 4, role: 'Motion axes and extruder' },
    { componentId: 'driver-stepper', quantity: 4, role: 'Stepper drivers' },
    { componentId: 'battery-lipo-3s', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['corexy-3d-printer'],
  applicableToolIds: ['T01', 'T02', 'T03', 'T05', 'T08', 'T09', 'T10', 'T12', 'T13'],
  requiredTools: ['Hex key set', 'Multimeter', 'Soldering iron'],
  assemblySteps: [{ order: 1, instruction: 'Assemble frame and belt routing', cautions: ['Ensure frame is square'] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'First print', expected: 'Test cube prints with correct dimensions' }],
  upgradeOptions: [],
  firmwareTarget: 'klipper',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
