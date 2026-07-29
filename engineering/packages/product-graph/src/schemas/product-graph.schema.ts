import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';

export const NodeCategorySchema = z.enum([
  'hardware', 'firmware', 'interface', 'mechanical', 'validation',
]);
export type NodeCategory = z.infer<typeof NodeCategorySchema>;

export const UserModeSchema = z.enum(['explore', 'builder', 'engineer']);
export type UserMode = z.infer<typeof UserModeSchema>;

export const MaturitySchema = z.enum(['concept', 'selected', 'validated', 'tested']);
export type Maturity = z.infer<typeof MaturitySchema>;

export const ConnectionTypeSchema = z.enum(['power', 'data', 'control', 'mechanical']);
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;

export const PositionSchema = z.object({ x: z.number(), y: z.number() });
export type Position = z.infer<typeof PositionSchema>;

export const LogicNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  category: NodeCategorySchema,
  parameters: z.record(z.string(), z.unknown()),
  capabilities: z.record(z.string(), z.unknown()),
  requirements: z.record(z.string(), z.unknown()),
  derivedMetrics: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  constraints: z.array(z.string()),
  connectedNodes: z.array(z.string()),
  position: PositionSchema,
  maturity: MaturitySchema.default('concept'),
});
export type LogicNode = z.infer<typeof LogicNodeSchema>;

export const ConnectionSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  type: ConnectionTypeSchema,
});
export type Connection = z.infer<typeof ConnectionSchema>;

export const ProductGraphSchema = z.object({
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().default('Untitled Product'),
  nodes: z.array(LogicNodeSchema),
  connections: z.array(ConnectionSchema),
  userMode: UserModeSchema.default('explore'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProductGraph = z.infer<typeof ProductGraphSchema>;
