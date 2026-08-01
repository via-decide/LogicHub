import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const OPENMV_LOCAL_VISION_KIT: PhysicalKitDefinition = {
  id: 'openmv_openipc_local_vision_bundle',
  name: 'OpenMV Local Vision Bundle',
  description: 'Local-first camera/vision appliance stack',
  components: [
    { componentId: 'controller-esp32-camera', quantity: 1, role: 'Vision controller' },
    { componentId: 'camera-global-shutter', quantity: 1, role: 'Global shutter imager' },
    { componentId: 'battery-lipo-3s', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['local-vision-appliance'],
  applicableToolIds: ['T01', 'T03', 'T05', 'T08', 'T11', 'T12', 'T14'],
  requiredTools: ['Small Phillips screwdriver'],
  assemblySteps: [{ order: 1, instruction: 'Assemble camera module', cautions: ['Static sensitive'] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'Capture frame', expected: 'Frame captures without corruption' }],
  upgradeOptions: [],
  firmwareTarget: 'openmv',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
