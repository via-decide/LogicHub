import { z } from 'zod';

export const ProjectStatusSchema = z.enum(['active', 'archived', 'suspended']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectVisibilitySchema = z.enum(['public', 'private', 'organization']);
export type ProjectVisibility = z.infer<typeof ProjectVisibilitySchema>;
