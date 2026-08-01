import { propagate } from '@logichub-engineering/product-graph';
import { kitToGraph } from './src/loader/kit-to-graph.js';
import { requireKit } from './src/kits/index.js';
import { aggregateCapabilities } from '@logichub-engineering/product-graph';

const kit = requireKit('electronics_research_bundle');
const graph = propagate(kitToGraph(kit, { now: '2026-01-01T00:00:00.000Z' })).graph;
const capabilities = aggregateCapabilities(graph);
console.log('CAPABILITIES:', capabilities);
console.log('NODES:');
for (const n of graph.nodes) {
  console.log(n.id, n.type, n.capabilities);
}
