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
        '<div class="lh-mobile-node-actions"><button type="button" data-node-action="duplicate" data-node-id="' + node.id + '">Duplicate</button><button type="button" data-node-action="delete" data-node-id="' + node.id + '">Delete</button></div>',
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
      var nodeAction = event.target.closest('[data-node-action]');
      if (nodeAction) {
        handleNodeAction(context, nodeId, nodeAction.dataset.nodeAction);
        event.stopPropagation();
        return;
      }
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

    bindTouchGestures(card, context, nodeId);
  }

  function bindTouchGestures(card, context, nodeId) {
    var touchData = { startX: 0, startY: 0, active: false, dragReady: false, timer: null, lastTap: 0 };
    card.addEventListener('touchstart', function (event) {
      if (!event.touches[0]) return;
      var now = Date.now();
      if (now - touchData.lastTap < 260) {
        context.state.selectedNodeId = nodeId;
        renderCanvasElements(context);
        context.onStateChange();
      }
      touchData.lastTap = now;
      touchData.active = true;
      touchData.dragReady = false;
      touchData.startX = event.touches[0].clientX;
      touchData.startY = event.touches[0].clientY;
      touchData.timer = setTimeout(function () { touchData.dragReady = true; }, 320);
    }, { passive: true });

    card.addEventListener('touchmove', function (event) {
      if (!touchData.active || !event.touches[0]) return;
      var node = global.LogicHubStudioGraph.getNodeById(context.state, nodeId);
      if (!node) return;
      var dx = event.touches[0].clientX - touchData.startX;
      var dy = event.touches[0].clientY - touchData.startY;
      if (touchData.dragReady) {
        node.x = Math.max(8, node.x + dx);
        node.y = Math.max(8, node.y + dy);
      } else if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx)) {
        moveNodeInList(context.state, nodeId, dy > 0 ? 1 : -1);
      }
      touchData.startX = event.touches[0].clientX;
      touchData.startY = event.touches[0].clientY;
      renderCanvasElements(context);
      context.onStateChange();
      event.preventDefault();
    }, { passive: false });

    card.addEventListener('touchend', function () {
      clearTimeout(touchData.timer);
      touchData.active = false;
      touchData.dragReady = false;
    });
  }

  function moveNodeInList(state, nodeId, direction) {
    var idx = state.nodes.findIndex(function (node) { return node.id === nodeId; });
    if (idx < 0) return;
    var nextIdx = Math.max(0, Math.min(state.nodes.length - 1, idx + direction));
    if (nextIdx === idx) return;
    var moved = state.nodes.splice(idx, 1)[0];
    state.nodes.splice(nextIdx, 0, moved);
  }

  function handleNodeAction(context, nodeId, action) {
    var node = global.LogicHubStudioGraph.getNodeById(context.state, nodeId);
    if (!node) return;
    if (action === 'delete') {
      context.state.nodes = context.state.nodes.filter(function (item) { return item.id !== nodeId; });
      context.state.edges = context.state.edges.filter(function (edge) { return edge.from !== nodeId && edge.to !== nodeId; });
      context.state.selectedNodeId = context.state.nodes[0] ? context.state.nodes[0].id : null;
    }
    if (action === 'duplicate') {
      var clone = global.LogicHubStudioGraph.createNode(context.state, node.type, node.x + 12, node.y + 12);
      clone.title = node.title + ' Copy';
      clone.description = node.description;
      context.state.selectedNodeId = clone.id;
    }
    renderCanvasElements(context);
    context.onStateChange();
  }

  function setupBuilderCanvas(context) {
    var canvas = context.canvas;
    var pinchData = { distance: 0 };

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

    canvas.addEventListener('touchmove', function (event) {
      if (event.touches.length !== 2) return;
      var dx = event.touches[0].clientX - event.touches[1].clientX;
      var dy = event.touches[0].clientY - event.touches[1].clientY;
      var distance = Math.sqrt((dx * dx) + (dy * dy));
      if (!pinchData.distance) {
        pinchData.distance = distance;
        return;
      }
      var delta = (distance - pinchData.distance) / 300;
      var nextZoom = Math.max(0.65, Math.min(1.55, (context.state.canvasZoom || 1) + delta));
      context.state.canvasZoom = nextZoom;
      context.canvasNodeLayer.style.transformOrigin = 'top left';
      context.canvasEdgeLayer.style.transformOrigin = 'top left';
      context.canvasNodeLayer.style.transform = 'scale(' + nextZoom + ')';
      context.canvasEdgeLayer.style.transform = 'scale(' + nextZoom + ')';
      pinchData.distance = distance;
      event.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', function () {
      pinchData.distance = 0;
    });

    renderCanvasElements(context);
  }

  global.LogicHubStudioCanvas = {
    handleNodeAction: handleNodeAction,
    setupBuilderCanvas: setupBuilderCanvas,
    renderCanvasElements: renderCanvasElements
  };
})(window);
