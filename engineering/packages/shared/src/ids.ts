import { z } from 'zod';

export const ProjectIdSchema = z.string().min(1);
export type ProjectId = z.infer<typeof ProjectIdSchema>;

export const RevisionIdSchema = z.string().min(1);
export type RevisionId = z.infer<typeof RevisionIdSchema>;

export const EngineeringObjectIdSchema = z.string().min(1);
export type EngineeringObjectId = z.infer<typeof EngineeringObjectIdSchema>;

export const ConstraintIdSchema = z.string().min(1);
export type ConstraintId = z.infer<typeof ConstraintIdSchema>;

export const DecisionIdSchema = z.string().min(1);
export type DecisionId = z.infer<typeof DecisionIdSchema>;

export const ArtifactIdSchema = z.string().min(1);
export type ArtifactId = z.infer<typeof ArtifactIdSchema>;

export const ChangeIntentIdSchema = z.string().min(1);
export type ChangeIntentId = z.infer<typeof ChangeIntentIdSchema>;

export const ValidationResultIdSchema = z.string().min(1);
export type ValidationResultId = z.infer<typeof ValidationResultIdSchema>;

export const ModuleIdSchema = z.string().min(1);
export type ModuleId = z.infer<typeof ModuleIdSchema>;

export const EngineeringPullRequestIdSchema = z.string().min(1);
export type EngineeringPullRequestId = z.infer<typeof EngineeringPullRequestIdSchema>;
