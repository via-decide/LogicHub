(function (global) {
  'use strict';

  function renderPreview(context) {
    var panel = context.previewPanel;
    var graph = { nodes: context.state.nodes, edges: context.state.edges };
    var parsed = global.LogicHubWorkflowParser.parseGraph(graph);
    var validation = global.LogicHubExecutionValidator.validatePlan(parsed);
    var plan = validation.ok ? global.LogicHubNodeCompiler.compile(parsed) : null;

    if (!context.state.nodes.length) {
      panel.innerHTML = '<p class="lh-empty">Drop components to begin building your workflow.</p>';
      return;
    }

    panel.innerHTML = [
      '<div class="lh-preview-grid">',
      context.state.nodes.map(function (node) { return '<article><h5>' + node.title + '</h5><p>' + node.type + '</p></article>'; }).join(''),
      '</div>',
      '<pre>' + JSON.stringify({ validation: validation, executionPlan: plan, runtime: context.lastRuntimeResult || null }, null, 2) + '</pre>'
    ].join('');
  }

  global.LogicHubStudioPreview = { renderPreview: renderPreview };
})(window);
