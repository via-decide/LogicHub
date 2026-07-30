import { z } from 'zod';

/**
 * Who a generated surface is for. The three surfaces are deliberately
 * separate: merging them would produce one unrestricted application, which is
 * exactly what the authority model exists to prevent.
 */
export const AuthorityLevelSchema = z.enum(['operator', 'engineering', 'service']);
export type AuthorityLevel = z.infer<typeof AuthorityLevelSchema>;

/**
 * Every capability a surface can hold. A surface may only offer an action it
 * holds the matching permission for; the generators check this, they do not
 * assume it.
 */
export const PermissionSchema = z.enum([
  'status.read',
  'alerts.read',
  'control.actuate',
  'config.read',
  'config.write',
  'pinmap.write',
  'calibration.read',
  'calibration.write',
  'firmware.parameters.write',
  'firmware.flash',
  'simulation.run',
  'revision.compare',
  'validation.read',
  'diagnostics.run',
  'component.replace',
  'maintenance.read',
  'maintenance.write',
  'evidence.capture',
]);
export type Permission = z.infer<typeof PermissionSchema>;

export const ALL_PERMISSIONS: readonly Permission[] = PermissionSchema.options;

/**
 * What each authority is granted.
 *
 * The operator surface drives the product and nothing else: it cannot rewrite
 * configuration, recalibrate, or flash firmware. Engineering configures and
 * analyses but does not flash the device or replace parts. Service diagnoses,
 * replaces, recalibrates and flashes, but does not redesign the product and
 * does not drive it as an operator would.
 */
export const PERMISSION_GRANTS: Record<AuthorityLevel, readonly Permission[]> = {
  operator: [
    'status.read',
    'alerts.read',
    'control.actuate',
  ],
  engineering: [
    'status.read',
    'alerts.read',
    'config.read',
    'config.write',
    'pinmap.write',
    'calibration.read',
    'calibration.write',
    'firmware.parameters.write',
    'simulation.run',
    'revision.compare',
    'validation.read',
  ],
  service: [
    'status.read',
    'alerts.read',
    'config.read',
    'calibration.read',
    'calibration.write',
    'firmware.flash',
    'diagnostics.run',
    'component.replace',
    'maintenance.read',
    'maintenance.write',
    'evidence.capture',
  ],
};

export function permissionsFor(authority: AuthorityLevel): readonly Permission[] {
  return PERMISSION_GRANTS[authority];
}

export function holdsPermission(authority: AuthorityLevel, permission: Permission): boolean {
  return PERMISSION_GRANTS[authority].includes(permission);
}

/**
 * Guard used by the generators. An action a surface has no authority for is a
 * programming error, not something to render disabled and hope nobody presses.
 */
export function assertPermitted(authority: AuthorityLevel, permission: Permission): void {
  if (!holdsPermission(authority, permission)) {
    throw new Error(`The ${authority} surface does not hold ${permission}.`);
  }
}
