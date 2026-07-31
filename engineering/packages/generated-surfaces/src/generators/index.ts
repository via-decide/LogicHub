import type { ProductGraph } from '@logichub-engineering/product-graph';
import type { GeneratedSurface, SurfaceSet } from '../schemas/surface.schema.js';
import { holdsPermission } from '../schemas/authority.schema.js';
import { generateOperatorSurface } from './operator-surface.js';
import { generateEngineeringSurface, compareRevisions } from './engineering-surface.js';
import { generateServiceSurface, type ServiceSurfaceOptions } from './service-surface.js';

export { generateOperatorSurface } from './operator-surface.js';
export {
  generateEngineeringSurface,
  compareRevisions,
  type RevisionDifference,
} from './engineering-surface.js';
export { generateServiceSurface, type ServiceSurfaceOptions } from './service-surface.js';

/**
 * Generate all three surfaces from one ProductGraph.
 *
 * They are returned as three separate surfaces on purpose. There is no
 * combined surface and no way to ask for one: merging them would produce a
 * single unrestricted application holding every permission at once, which is
 * precisely what the authority split exists to prevent.
 */
export function generateAllSurfaces(
  graph: ProductGraph,
  options: ServiceSurfaceOptions = {},
): SurfaceSet {
  return {
    sourceGraphId: graph.id,
    operator: generateOperatorSurface(graph),
    engineering: generateEngineeringSurface(graph),
    service: generateServiceSurface(graph, options),
  };
}

export interface AuthorityViolation {
  authority: string;
  sectionId: string;
  controlId: string | null;
  permission: string;
  message: string;
}

/**
 * Check that a surface only ever asks for authority it actually holds.
 *
 * This is the guard behind the whole model: a generator that grows a new
 * control is caught here rather than shipping a surface that offers an action
 * its holder has no right to perform.
 */
export function findAuthorityViolations(surface: GeneratedSurface): AuthorityViolation[] {
  const violations: AuthorityViolation[] = [];

  for (const section of surface.sections) {
    if (!holdsPermission(surface.authority, section.requiresPermission)) {
      violations.push({
        authority: surface.authority,
        sectionId: section.id,
        controlId: null,
        permission: section.requiresPermission,
        message:
          `The ${surface.authority} surface renders section "${section.id}" but does not `
          + `hold ${section.requiresPermission}.`,
      });
    }

    for (const control of section.controls) {
      if (!holdsPermission(surface.authority, control.requiresPermission)) {
        violations.push({
          authority: surface.authority,
          sectionId: section.id,
          controlId: control.id,
          permission: control.requiresPermission,
          message:
            `The ${surface.authority} surface offers control "${control.id}" but does not `
            + `hold ${control.requiresPermission}.`,
        });
      }
    }
  }

  return violations;
}

export { compareRevisions as compareSurfaceRevisions };
