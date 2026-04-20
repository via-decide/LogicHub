(function (global) {
  'use strict';

  function renderCanvasElements(context) {
    var nodeLayer = context.canvasNodeLayer;
    var edgeLayer = context.canvasEdgeLayer;

    nodeLayer.innerHTML = '';
    edgeLayer.innerHTML = '';

    context.state.edges.forEach(function (edge) {
      var source = global.LogicHubStudioGraph.getNodeById(context.state, edge.from);
      var target = global.LogicHubStudioGraph.getNodeById(context.state, edge.to);
      if (!source || !target) return;

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      var startX = source.x + 184;
      var startY = source.y + 40;
      var endX = target.x;
      var endY = target.y + 40;
      var control = Math.max(48, Math.abs(endX - startX) * 0.45);
      path.setAttribute('d', 'M ' + startX + ' ' + startY + ' C ' + (startX + control) + ' ' + startY + ', ' + (endX - control) + ' ' + endY + ', ' + endX + ' ' + endY);
      path.setAttribute('class', 'lh-edge');
      edgeLayer.appendChild(path);
    });

    context.state.nodes.forEach(function (node) {
      var card = document.createElement('article');
      card.className = 'lh-node' + (node.id === context.state.selectedNodeId ? ' is-selected' : '');
      card.dataset.nodeId = node.id;
      card.style.left = node.x + 'px';
      card.style.top = node.y + 'px';
      card.innerHTML = [
        '<header><h4>' + node.title + '</h4><small>' + node.type + '</small></header>',
        '<p>' + (node.description || 'No description yet') + '</p>',
        '<button class="lh-link-port" data-link-source="' + node.id + '" title="Start connection">⤳</button>'
      ].join('');

      bindNodeEvents(card, context, node.id);
      nodeLayer.appendChild(card);
    });
  }

  function bindNodeEvents(card, context, nodeId) {
    var dragHandleActive = false;
    var offsetX = 0;
    var offsetY = 0;

    card.addEventListener('mousedown', function (event) {
      if (event.target.closest('[data-link-source]')) return;

      dragHandleActive = true;
      context.state.selectedNodeId = nodeId;
      var node = global.LogicHubStudioGraph.getNodeById(context.state, nodeId);
      offsetX = event.clientX - node.x;
      offsetY = event.clientY - node.y;
      renderCanvasElements(context);
      context.onStateChange();
    });

    document.addEventListener('mousemove', function (event) {
      if (!dragHandleActive) return;
      var node = global.LogicHubStudioGraph.getNodeById(context.state, nodeId);
      if (!node) return;

      node.x = Math.max(8, event.clientX - offsetX);
      node.y = Math.max(8, event.clientY - offsetY);
      renderCanvasElements(context);
      context.onStateChange();
    });

    document.addEventListener('mouseup', function () {
      dragHandleActive = false;
    });

    card.addEventListener('click', function (event) {
      var sourceButton = event.target.closest('[data-link-source]');
      if (sourceButton) {
        context.state.activeLinkSourceId = sourceButton.dataset.linkSource;
        return;
      }

      if (context.state.activeLinkSourceId && context.state.activeLinkSourceId !== nodeId) {
        global.LogicHubStudioGraph.upsertEdge(context.state, context.state.activeLinkSourceId, nodeId);
        context.state.activeLinkSourceId = null;
      }

      context.state.selectedNodeId = nodeId;
      renderCanvasElements(context);
      context.onStateChange();
    });
  }

  function setupBuilderCanvas(context) {
    var canvas = context.canvas;

    canvas.addEventListener('dragover', function (event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });

    canvas.addEventListener('drop', function (event) {
      event.preventDefault();
      var type = event.dataTransfer.getData('text/plain');
      if (!type) return;

      var rect = canvas.getBoundingClientRect();
      var node = global.LogicHubStudioGraph.createNode(
        context.state,
        type,
        event.clientX - rect.left - 92,
        event.clientY - rect.top - 40
      );

      context.state.selectedNodeId = node.id;
      renderCanvasElements(context);
      context.onStateChange();
    });

    renderCanvasElements(context);
  }

  global.LogicHubStudioCanvas = {
    setupBuilderCanvas: setupBuilderCanvas,
    renderCanvasElements: renderCanvasElements
  };
})(window);
