import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';
import { MOTION_STARTER_KIT } from './motion-starter.js';
import { ENVIRONMENT_STARTER_KIT } from './environment-starter.js';
import { MOTION_AND_VISION_KIT } from './motion-and-vision.js';
import { PRODUCT_INTERFACE_KIT } from './product-interface.js';
import { ELECTRONICS_RESEARCH_KIT } from './electronics-research.js';
import { DRONE_CAD_IMPLEMENTATION_KIT } from './drone-cad-implementation.js';
import { PUPPER_V3_RESEARCH_KIT } from './pupper-v3-research.js';
import { FARMBOT_RESEARCH_KIT } from './farmbot-research.js';
import { OPENFLEXURE_MICROSCOPE_KIT } from './openflexure-microscope.js';
import { SATNOGS_GROUND_STATION_KIT } from './satnogs-ground-station.js';
import { VORON_3D_PRINTER_KIT } from './voron-3d-printer.js';
import { OPENEVSE_RESEARCH_KIT } from './openevse-research.js';
import { OPENMV_LOCAL_VISION_KIT } from './openmv-local-vision.js';
import { RISCV_EDGE_COMPUTE_KIT } from './riscv-edge-compute.js';
import { PRECIOUS_PLASTIC_ECOSYSTEM_KIT } from './precious-plastic-ecosystem.js';
import { NASA_JPL_ROVER_KIT } from './nasa-jpl-rover.js';

export { MOTION_STARTER_KIT } from './motion-starter.js';
export { ENVIRONMENT_STARTER_KIT } from './environment-starter.js';
export { MOTION_AND_VISION_KIT } from './motion-and-vision.js';
export { PRODUCT_INTERFACE_KIT } from './product-interface.js';
export { ELECTRONICS_RESEARCH_KIT } from './electronics-research.js';
export { DRONE_CAD_IMPLEMENTATION_KIT } from './drone-cad-implementation.js';
export { PUPPER_V3_RESEARCH_KIT } from './pupper-v3-research.js';
export { FARMBOT_RESEARCH_KIT } from './farmbot-research.js';
export { OPENFLEXURE_MICROSCOPE_KIT } from './openflexure-microscope.js';
export { SATNOGS_GROUND_STATION_KIT } from './satnogs-ground-station.js';
export { VORON_3D_PRINTER_KIT } from './voron-3d-printer.js';
export { OPENEVSE_RESEARCH_KIT } from './openevse-research.js';
export { OPENMV_LOCAL_VISION_KIT } from './openmv-local-vision.js';
export { RISCV_EDGE_COMPUTE_KIT } from './riscv-edge-compute.js';
export { PRECIOUS_PLASTIC_ECOSYSTEM_KIT } from './precious-plastic-ecosystem.js';
export { NASA_JPL_ROVER_KIT } from './nasa-jpl-rover.js';

/** The canonical kit definitions, in a stable order. */
export const REFERENCE_KITS: readonly PhysicalKitDefinition[] = [
  MOTION_STARTER_KIT,
  ENVIRONMENT_STARTER_KIT,
  MOTION_AND_VISION_KIT,
  PRODUCT_INTERFACE_KIT,
  ELECTRONICS_RESEARCH_KIT,
  DRONE_CAD_IMPLEMENTATION_KIT,
  PUPPER_V3_RESEARCH_KIT,
  FARMBOT_RESEARCH_KIT,
  OPENFLEXURE_MICROSCOPE_KIT,
  SATNOGS_GROUND_STATION_KIT,
  VORON_3D_PRINTER_KIT,
  OPENEVSE_RESEARCH_KIT,
  OPENMV_LOCAL_VISION_KIT,
  RISCV_EDGE_COMPUTE_KIT,
  PRECIOUS_PLASTIC_ECOSYSTEM_KIT,
  NASA_JPL_ROVER_KIT,
];

const BY_ID = new Map(REFERENCE_KITS.map(k => [k.id, k]));

export function getKit(id: string): PhysicalKitDefinition | undefined {
  return BY_ID.get(id);
}

export function requireKit(id: string): PhysicalKitDefinition {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown kit: ${id}`);
  return found;
}
