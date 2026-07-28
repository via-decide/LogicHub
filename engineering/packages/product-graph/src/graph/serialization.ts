import { ProductGraphSchema, type ProductGraph } from '../schemas/product-graph.schema.js';

export function serializeGraph(graph: ProductGraph): string {
  return JSON.stringify(graph);
}

export function deserializeGraph(json: string): ProductGraph {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }

  const result = ProductGraphSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${result.error.issues.map(i => i.message).join(', ')}`);
  }

  return result.data;
}
