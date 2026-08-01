import { propagate, aggregateCapabilities } from './engineering/packages/product-graph/dist/index.js';
import { kitToGraph } from './engineering/packages/kit-matching/dist/loader/kit-to-graph.js';
import { requireKit } from './engineering/packages/kit-matching/dist/kits/index.js';

const kit = requireKit('electronics_research_bundle');
const graph = propagate(kitToGraph(kit, { now: '2026-01-01T00:00:00.000Z' })).graph;
const capabilities = aggregateCapabilities(graph);
console.log('CAPABILITIES:', capabilities);
for (const n of graph.nodes) {
  console.log('NODE:', n.id, n.type, 'CAPS:', n.capabilities);
}
