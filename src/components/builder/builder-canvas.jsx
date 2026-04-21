(function (global) {
  'use strict';

  var INSERT_ANIMATION_MS = 220;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getVisibleNodes(context) {
    var viewport = context.canvas.getBoundingClientRect();
    var zoom = context.state.canvasZoom || 1;
    var pad = 120;
    var minX = (-pad) / zoom;
    var minY = (-pad) / zoom;
    var maxX = (viewport.width + pad) / zoom;
    var maxY = (viewport.height + pad) / zoom;

    return context.state.nodes.filter(function (node) {
      var nodeRight = node.x + 188;
      var nodeBottom = node.y + 112;
      return nodeRight >= minX && node.x <= maxX && nodeBottom >= minY && node.y <= maxY;
    });
  }

  function renderCanvasElements(context) {
    var nodeLayer = context.canvasNodeLayer;
    var edgeLayer = context.canvasEdgeLayer;
    var visibleNodes = getVisibleNodes(context);
    var visibleNodeIds = {};

    nodeLayer.innerHTML = '';
    edgeLayer.innerHTML = '';

    visibleNodes.forEach(function (node) {
      visibleNodeIds[node.id] = true;
    });

    context.state.edges.forEach(function (edge) {
      if (!visibleNodeIds[edge.from] && !visibleNodeIds[edge.to]) return;
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

    visibleNodes.forEach(function (node) {
      var card = document.createElement('article');
      var entering = context.state.justInsertedNodeId === node.id;
      card.className = 'lh-block' + (node.id === context.state.selectedNodeId ? ' is-selected' : '') + (entering ? ' is-entering' : '');
      card.dataset.nodeId = node.id;
      card.style.left = node.x + 'px';
      card.style.top = node.y + 'px';
      card.innerHTML = [
        '<div class="lh-content">',
        '<header><h4 data-inline-field="title" contenteditable="' + (node.id === context.state.selectedNodeId) + '">' + escapeHtml(node.title) + '</h4><small>' + node.type + '</small></header>',
        '<p data-inline-field="description" contenteditable="' + (node.id === context.state.selectedNodeId) + '">' + escapeHtml(node.description || 'Tap to add details') + '</p>',
        '</div>'
      ].join('');
      nodeLayer.appendChild(card);
    });

    renderSelectionOverlay(context);

    if (context.state.justInsertedNodeId) {
      var insertedNodeId = context.state.justInsertedNodeId;
      setTimeout(function () {
        if (context.state.justInsertedNodeId === insertedNodeId) {
          context.state.justInsertedNodeId = null;
          renderCanvasElements(context);
        }
      }, INSERT_ANIMATION_MS);
    }
  }

  function renderSelectionOverlay(context) {
    if (!context.state.selectedNodeId) return;
    var node = global.LogicHubStudioGraph.getNodeById(context.state, context.state.selectedNodeId);
    if (!node) return;

    var overlay = document.createElement('div');
    overlay.className = 'lh-selection-overlay';
    overlay.style.left = node.x + 'px';
    overlay.style.top = (node.y - 42) + 'px';
    overlay.innerHTML = '<button type="button" data-node-action="duplicate">Duplicate</button><button type="button" data-node-action="delete">Delete</button>';
    context.canvasNodeLayer.appendChild(overlay);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function setupInteractionController(context) {
    var activeTouch = {
      nodeId: null,
      startX: 0,
      startY: 0,
      moved: false,
      startAt: 0,
      dragReady: false,
      dragTimer: null,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      lastDY: 0
    };

    function selectNode(nodeId) {
      context.state.selectedNodeId = nodeId;
      renderCanvasElements(context);
      context.onStateChange();
    }

    context.canvasNodeLayer.addEventListener('click', function (event) {
      var action = event.target.closest('[data-node-action]');
      if (action && context.state.selectedNodeId) {
        handleNodeAction(context, context.state.selectedNodeId, action.dataset.nodeAction);
        return;
      }

      var card = event.target.closest('[data-node-id]');
      if (!card) return;
      selectNode(card.dataset.nodeId);
    });

    context.canvasNodeLayer.addEventListener('input', function (event) {
      var field = event.target.closest('[data-inline-field]');
      var card = event.target.closest('[data-node-id]');
      if (!field || !card) return;
      var patch = {};
      patch[field.dataset.inlineField] = field.textContent.trim();
      global.LogicHubStudioGraph.updateNode(context.state, card.dataset.nodeId, patch);
      context.onStateChange();
    });

    context.canvasNodeLayer.addEventListener('touchstart', function (event) {
      var card = event.target.closest('[data-node-id]');
      if (!card || !event.touches[0]) return;
      var node = global.LogicHubStudioGraph.getNodeById(context.state, card.dataset.nodeId);
      if (!node) return;
      activeTouch.nodeId = node.id;
      activeTouch.startX = event.touches[0].clientX;
      activeTouch.startY = event.touches[0].clientY;
      activeTouch.pointerOffsetX = activeTouch.startX - node.x;
      activeTouch.pointerOffsetY = activeTouch.startY - node.y;
      activeTouch.moved = false;
      activeTouch.startAt = Date.now();
      activeTouch.dragReady = false;
      clearTimeout(activeTouch.dragTimer);
      activeTouch.dragTimer = setTimeout(function () {
        activeTouch.dragReady = true;
      }, 420);
    }, { passive: true });

    context.canvasNodeLayer.addEventListener('touchmove', function (event) {
      if (!activeTouch.nodeId || !event.touches[0]) return;
      var node = global.LogicHubStudioGraph.getNodeById(context.state, activeTouch.nodeId);
      if (!node) return;
      var x = event.touches[0].clientX;
      var y = event.touches[0].clientY;
      var dx = x - activeTouch.startX;
      var dy = y - activeTouch.startY;
      activeTouch.lastDY = dy;
      activeTouch.moved = activeTouch.moved || Math.abs(dx) > 8 || Math.abs(dy) > 8;

      if (activeTouch.dragReady) {
        node.x = Math.max(8, x - activeTouch.pointerOffsetX);
        node.y = Math.max(8, y - activeTouch.pointerOffsetY);
        requestAnimationFrame(function () {
          renderCanvasElements(context);
          context.onStateChange();
        });
        event.preventDefault();
      }
    }, { passive: false });

    context.canvasNodeLayer.addEventListener('touchend', function () {
      if (!activeTouch.nodeId) return;
      var nodeId = activeTouch.nodeId;
      var duration = Date.now() - activeTouch.startAt;

      if (!activeTouch.moved && duration < 300) {
        selectNode(nodeId);
      } else if (!activeTouch.dragReady && activeTouch.moved && Math.abs(activeTouch.lastDY) > 24) {
        moveNodeInList(context.state, nodeId, activeTouch.lastDY > 0 ? 1 : -1);
        renderCanvasElements(context);
        context.onStateChange();
      }

      clearTimeout(activeTouch.dragTimer);
      activeTouch.nodeId = null;
      activeTouch.dragReady = false;
    });
  }

  function moveNodeInList(state, nodeId, direction) {
    var idx = state.nodes.findIndex(function (node) { return node.id === nodeId; });
    if (idx < 0) return;
    var nextIdx = clamp(idx + direction, 0, state.nodes.length - 1);
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
      context.state.justInsertedNodeId = clone.id;
    }

    renderCanvasElements(context);
    context.onStateChange();
  }

  function setupAutosave(context) {
    var queued = null;
    var initialOnStateChange = context.onStateChange;
    context.onStateChange = function () {
      initialOnStateChange();
      clearTimeout(queued);
      queued = setTimeout(function () {
        localStorage.setItem('lh-mobile-canvas-draft', JSON.stringify(context.state));
      }, 180);
    };
  }

  function setupBuilderCanvas(context) {
    var canvas = context.canvas;
    var pinchData = { distance: 0 };

    setupAutosave(context);
    setupInteractionController(context);

    canvas.addEventListener('dragover', function (event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });

    canvas.addEventListener('drop', function (event) {
      event.preventDefault();
      var type = event.dataTransfer.getData('text/plain');
      if (!type) return;

      var rect = canvas.getBoundingClientRect();
      var node = global.LogicHubStudioGraph.createNode(context.state, type, event.clientX - rect.left - 92, event.clientY - rect.top - 40);
      context.state.selectedNodeId = node.id;
      context.state.justInsertedNodeId = node.id;
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
      var nextZoom = clamp((context.state.canvasZoom || 1) + delta, 0.7, 1.5);
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
