(function (global) {
  'use strict';

  function parseGraph(graph) {
    var nodes = Array.isArray(graph && graph.nodes) ? graph.nodes : [];
    var edges = Array.isArray(graph && graph.edges) ? graph.edges : [];
    var nodeMap = {};
    var outgoing = {};
    var incomingCount = {};

    nodes.forEach(function (node) { nodeMap[node.id] = node; outgoing[node.id] = []; incomingCount[node.id] = 0; });
    edges.forEach(function (edge) {
      if (!nodeMap[edge.from] || !nodeMap[edge.to]) return;
      outgoing[edge.from].push(edge.to);
      incomingCount[edge.to] += 1;
    });

    var roots = nodes.filter(function (n) { return incomingCount[n.id] === 0; }).map(function (n) { return n.id; });
    return { nodes: nodes, edges: edges, nodeMap: nodeMap, outgoing: outgoing, incomingCount: incomingCount, roots: roots };
  }

  global.LogicHubWorkflowParser = { parseGraph: parseGraph };
})(window);
