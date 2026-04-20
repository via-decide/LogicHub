(function (global) {
  'use strict';

  function renderPreview(context) {
    var panel = context.previewPanel;
    var nodes = context.state.nodes;
    var edges = context.state.edges;

    if (!nodes.length) {
      panel.innerHTML = '<p class="lh-empty">Drop components to begin building your workflow.</p>';
      return;
    }

    panel.innerHTML = [
      '<div class="lh-preview-grid">',
      nodes.map(function (node) {
        return '<article><h5>' + node.title + '</h5><p>' + node.type + '</p></article>';
      }).join(''),
      '</div>',
      '<pre>' + JSON.stringify({ nodes: nodes, edges: edges }, null, 2) + '</pre>'
    ].join('');
  }

  global.LogicHubStudioPreview = {
    renderPreview: renderPreview
  };
})(window);
