import { z } from 'zod';

export const DecisionStatusSchema = z.enum(['proposed', 'accepted', 'rejected', 'superseded']);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const DecisionConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type DecisionConfidence = z.infer<typeof DecisionConfidenceSchema>;
