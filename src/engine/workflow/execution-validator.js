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

  function validateWorkflowModel(model) {
    var issues = [];
    var parser = global.LogicHubWorkflowParser;
    var parsed = parser && parser.parseWorkflow ? parser.parseWorkflow(model) : null;
    if (!parsed) return { ok: false, issues: ['Workflow parser is unavailable.'] };

    if (!parsed.workflow.trigger) {
      issues.push('Workflow trigger is required.');
    } else if (!parsed.hasSupportedTrigger) {
      issues.push('Unsupported trigger "' + parsed.workflow.trigger + '".');
    }

    if (!parsed.workflow.actions.length) issues.push('Workflow must include at least one action.');

    parsed.workflow.actions.forEach(function (action, index) {
      if (parsed.supportedActions.indexOf(action.type) === -1) {
        issues.push('Unsupported action at index ' + index + ': ' + action.type);
      }
      if (action.type === 'condition' && (!action.condition || !Array.isArray(action.then))) {
        issues.push('Condition action requires "condition" and "then" actions.');
      }
      if (action.type === 'loop' && !Array.isArray(action.actions)) {
        issues.push('Loop action requires nested "actions" array.');
      }
    });

    return { ok: issues.length === 0, issues: issues, parsed: parsed.workflow };
  }

  global.LogicHubExecutionValidator = {
    validatePlan: validatePlan,
    validateWorkflowModel: validateWorkflowModel
  };
})(window);
