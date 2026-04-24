(function (global) {
  'use strict';

  var SUPPORTED_TRIGGERS = {
    'button.click': true,
    'form.submit': true,
    'page.load': true,
    'data.update': true,
    'timer': true
  };

  var SUPPORTED_ACTIONS = {
    saveData: true,
    updateState: true,
    callApi: true,
    showNotification: true,
    redirect: true,
    toggleUi: true,
    sendEmail: true,
    runScript: true,
    condition: true,
    loop: true
  };

  function normalizeAction(action, index) {
    var safe = Object.assign({}, action || {});
    safe.id = safe.id || ('action_' + (index + 1));
    safe.type = safe.type || 'runScript';
    safe.title = safe.title || safe.type;
    safe.onError = Array.isArray(safe.onError) ? safe.onError : [];
    return safe;
  }

  function normalizeWorkflow(workflow) {
    var source = workflow || {};
    var actions = Array.isArray(source.actions) ? source.actions.map(normalizeAction) : [];
    return {
      id: source.id || 'workflow',
      trigger: source.trigger || '',
      actions: actions,
      metadata: Object.assign({}, source.metadata || {}),
      version: source.version || 1
    };
  }

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

  function parseWorkflow(input) {
    var normalized = normalizeWorkflow(input);
    return {
      workflow: normalized,
      supportedTriggers: Object.keys(SUPPORTED_TRIGGERS),
      supportedActions: Object.keys(SUPPORTED_ACTIONS),
      hasSupportedTrigger: Boolean(SUPPORTED_TRIGGERS[normalized.trigger])
    };
  }

  global.LogicHubWorkflowParser = {
    parseGraph: parseGraph,
    parseWorkflow: parseWorkflow,
    normalizeWorkflow: normalizeWorkflow,
    SUPPORTED_TRIGGERS: Object.keys(SUPPORTED_TRIGGERS),
    SUPPORTED_ACTIONS: Object.keys(SUPPORTED_ACTIONS)
  };
})(window);
