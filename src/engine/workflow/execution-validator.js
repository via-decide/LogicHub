(function (global) {
  'use strict';

  function validatePlan(parsed) {
    var issues = [];
    if (!parsed.nodes.length) issues.push('Workflow has no nodes.');
    parsed.edges.forEach(function (edge) { if (!parsed.nodeMap[edge.from] || !parsed.nodeMap[edge.to]) issues.push('Edge references missing node: ' + edge.from + ' -> ' + edge.to); });

    var visited = {}; var active = {};
    function walk(nodeId) {
      if (active[nodeId]) return true;
      if (visited[nodeId]) return false;
      visited[nodeId] = true; active[nodeId] = true;
      var cyclic = (parsed.outgoing[nodeId] || []).some(walk); active[nodeId] = false; return cyclic;
    }

    if (Object.keys(parsed.nodeMap).some(walk)) issues.push('Workflow contains a cycle; only directed acyclic graphs can execute.');
    if (parsed.nodes.length && !parsed.roots.length) issues.push('Workflow has no root node.');
    return { ok: issues.length === 0, issues: issues };
  }

  global.LogicHubExecutionValidator = { validatePlan: validatePlan };
})(window);
