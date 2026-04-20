(function (global) {
  'use strict';

  function compile(parsed) {
    var queue = parsed.roots.slice();
    var remainingIn = Object.assign({}, parsed.incomingCount);
    var ordered = [];
    while (queue.length) {
      var nodeId = queue.shift();
      ordered.push(parsed.nodeMap[nodeId]);
      (parsed.outgoing[nodeId] || []).forEach(function (toId) {
        remainingIn[toId] -= 1;
        if (remainingIn[toId] === 0) queue.push(toId);
      });
    }

    return {
      orderedNodes: ordered,
      steps: ordered.map(function (node, index) { return { id: node.id, index: index + 1, type: node.type, title: node.title, run: node.description || '' }; })
    };
  }

  global.LogicHubNodeCompiler = { compile: compile };
})(window);
