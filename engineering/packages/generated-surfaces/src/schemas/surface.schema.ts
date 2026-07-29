import { z } from 'zod';
import { AuthorityLevelSchema, PermissionSchema } from './authority.schema.js';

/**
 * How much is actually known about a displayed value. A surface must never
 * present an estimate or a simulation as though it were a measurement.
 */
export const EpistemicStateSchema = z.enum([
  'ESTIMATED',
  'CALCULATED',
  'SIMULATED',
  'MEASURED',
  'VERIFIED',
  'UNKNOWN',
]);
export type EpistemicState = z.infer<typeof EpistemicStateSchema>;

export const ControlKindSchema = z.enum(['slider', 'toggle', 'joystick', 'button', 'field']);
export type ControlKind = z.infer<typeof ControlKindSchema>;

export const SurfaceControlSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  kind: ControlKindSchema,
  label: z.string().min(1),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
  /** The permission a surface must hold to render this control at all. */
  requiresPermission: PermissionSchema,
  /**
   * The generated surface is a remote instruction path. Whatever it commands
   * remains subject to the interlocks enforced in firmware, which it cannot
   * override, disable, or talk past.
   */
  firmwareInterlockRequired: z.literal(true),
});
export type SurfaceControl = z.infer<typeof SurfaceControlSchema>;

export const SurfaceReadoutSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  label: z.string().min(1),
  unit: z.string(),
  /** Present when a value is genuinely known; absent means not yet known. */
  value: z.union([z.number(), z.string(), z.boolean()]).optional(),
  epistemicState: EpistemicStateSchema,
});
export type SurfaceReadout = z.infer<typeof SurfaceReadoutSchema>;

export const SurfaceAlertSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string().min(1),
});
export type SurfaceAlert = z.infer<typeof SurfaceAlertSchema>;

export const SurfaceSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  requiresPermission: PermissionSchema,
  controls: z.array(SurfaceControlSchema),
  readouts: z.array(SurfaceReadoutSchema),
  /**
   * Set when a section exists but has nothing to show yet, with the reason.
   * An empty section is never dressed up as a populated one.
   */
  emptyReason: z.string().nullable(),
});
export type SurfaceSection = z.infer<typeof SurfaceSectionSchema>;

export const OfflineBehaviourSchema = z.object({
  /** Whether a link exists at all for the surface to lose. */
  linkAvailable: z.boolean(),
  /** What the surface shows when the link drops. */
  policy: z.enum(['no-link', 'last-known-state', 'read-only']),
  description: z.string().min(1),
});
export type OfflineBehaviour = z.infer<typeof OfflineBehaviourSchema>;

export const GeneratedSurfaceSchema = z.object({
  authority: AuthorityLevelSchema,
  name: z.string().min(1),
  /** Derived from the graph this surface was generated from. */
  sourceGraphId: z.string().min(1),
  permissions: z.array(PermissionSchema),
  sections: z.array(SurfaceSectionSchema),
  alerts: z.array(SurfaceAlertSchema),
  offline: OfflineBehaviourSchema,
});
export type GeneratedSurface = z.infer<typeof GeneratedSurfaceSchema>;

export const SurfaceSetSchema = z.object({
  sourceGraphId: z.string().min(1),
  operator: GeneratedSurfaceSchema,
  engineering: GeneratedSurfaceSchema,
  service: GeneratedSurfaceSchema,
});
export type SurfaceSet = z.infer<typeof SurfaceSetSchema>;
