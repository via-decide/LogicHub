import type { PhysicalKitDefinition } from '../schemas/kit.schema.js';
import { MOTION_STARTER_KIT } from './motion-starter.js';
import { ENVIRONMENT_STARTER_KIT } from './environment-starter.js';
import { MOTION_AND_VISION_KIT } from './motion-and-vision.js';
import { PRODUCT_INTERFACE_KIT } from './product-interface.js';

export { MOTION_STARTER_KIT } from './motion-starter.js';
export { ENVIRONMENT_STARTER_KIT } from './environment-starter.js';
export { MOTION_AND_VISION_KIT } from './motion-and-vision.js';
export { PRODUCT_INTERFACE_KIT } from './product-interface.js';

/** The four canonical kit definitions, in a stable order. */
export const REFERENCE_KITS: readonly PhysicalKitDefinition[] = [
  MOTION_STARTER_KIT,
  ENVIRONMENT_STARTER_KIT,
  MOTION_AND_VISION_KIT,
  PRODUCT_INTERFACE_KIT,
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
