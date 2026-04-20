(function (global) {
  'use strict';

  function mapStepsToNodes(structuredTask) {
    return structuredTask.steps.map(function (step, index) {
      var column = index % 3;
      var row = Math.floor(index / 3);

      return {
        id: 'node-' + (index + 1),
        type: step.type,
        title: step.title,
        description: step.description,
        x: 28 + (column * 220),
        y: 28 + (row * 150)
      };
    });
  }

  function mapNodesToEdges(nodes) {
    return nodes.slice(1).map(function (node, index) {
      return {
        from: nodes[index].id,
        to: node.id
      };
    });
  }

  function generateWorkflow(structuredTask) {
    var nodes = mapStepsToNodes(structuredTask);
    var edges = mapNodesToEdges(nodes);

    return {
      task: structuredTask,
      graph: {
        nodes: nodes,
        edges: edges
      }
    };
  }

  global.LogicHubWorkflowGenerator = {
    generateWorkflow: generateWorkflow
  };
})(window);
