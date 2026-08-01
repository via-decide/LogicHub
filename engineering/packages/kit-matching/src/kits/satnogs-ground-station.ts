import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';

export const SATNOGS_GROUND_STATION_KIT: PhysicalKitDefinition = {
  id: 'satnogs_ground_station_research_bundle',
  name: 'SatNOGS Ground Station Research Bundle',
  description: 'Receive-only satellite ground-station learning appliance',
  components: [
    { componentId: 'controller-linux', quantity: 1, role: 'Main controller' },
    { componentId: 'radio-sdr', quantity: 1, role: 'RF receiver' },
    { componentId: 'battery-lipo-3s', quantity: 1, role: 'Power source' },

    { componentId: 'wiring-jumper-set', quantity: 1, role: 'Interconnect' },
  ],
  supportedProductTemplateIds: ['satellite-ground-station'],
  applicableToolIds: ['T01', 'T03', 'T05', 'T08', 'T10', 'T11', 'T13', 'T14'],
  requiredTools: ['Wrench set', 'Coaxial crimper'],
  assemblySteps: [{ order: 1, instruction: 'Assemble antenna and connect SDR', cautions: [] }, { order: 2, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }],
  testProcedure: [{ order: 1, check: 'Receive test', expected: 'Decodes NOAA weather satellite' }],
  upgradeOptions: [],
  firmwareTarget: 'linux',
  assemblyDifficulty: 'advanced',
  validationStatus: 'UNVALIDATED',
};
