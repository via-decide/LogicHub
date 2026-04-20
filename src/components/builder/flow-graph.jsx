(function (global) {
  'use strict';

  function createGraphState() {
    return {
      nodes: [],
      edges: [],
      selectedNodeId: null,
      activeLinkSourceId: null,
      idCounter: 0
    };
  }

  function createNode(state, type, x, y) {
    state.idCounter += 1;
    var node = {
      id: 'node-' + state.idCounter,
      type: type,
      title: type + ' Node',
      description: '',
      x: x,
      y: y
    };

    state.nodes.push(node);
    return node;
  }

  function getNodeById(state, nodeId) {
    return state.nodes.find(function (node) {
      return node.id === nodeId;
    }) || null;
  }

  function upsertEdge(state, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;

    var exists = state.edges.some(function (edge) {
      return edge.from === fromId && edge.to === toId;
    });

    if (!exists) {
      state.edges.push({ from: fromId, to: toId });
    }
  }

  function updateNode(state, nodeId, patch) {
    var node = getNodeById(state, nodeId);
    if (!node) return;

    Object.assign(node, patch);
  }

  global.LogicHubStudioGraph = {
    createGraphState: createGraphState,
    createNode: createNode,
    getNodeById: getNodeById,
    upsertEdge: upsertEdge,
    updateNode: updateNode
  };
})(window);
