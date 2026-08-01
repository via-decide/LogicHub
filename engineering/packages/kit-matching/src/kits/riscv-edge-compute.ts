import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const RISCV_EDGE_COMPUTE_KIT: PhysicalKitDefinition = {
  id: 'riscv_edge_beaglev_fire_milkv_duo_bundle',
  name: 'RISC-V Edge Compute Bundle',
  description: 'RISC-V edge compute, FPGA, AIoT, embedded Linux',
  components: [
    { componentId: 'controller-riscv', quantity: 1, role: 'Main compute node' },
    { componentId: 'battery-lipo-3s', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['riscv-edge-compute'],
  applicableToolIds: ['T01', 'T03', 'T05', 'T07', 'T08', 'T10', 'T11', 'T12', 'T14'],
  requiredTools: ['USB cable'],
  assemblySteps: [{ order: 1, instruction: 'Flash SD card and boot', cautions: [] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'SSH login', expected: 'Successfully authenticate to Linux shell' }],
  upgradeOptions: [],
  firmwareTarget: 'linux',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
