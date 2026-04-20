(function (global) {
  'use strict';

  function createWorkflowRunner(options) {
    var apiClient = options.apiClient;
    var componentLoader = options.componentLoader;
    var state = options.stateManager;

    async function executeNode(node) {
      if (node.action === 'api' && node.request) {
        var payload = await apiClient(node.request, state.getState());
        state.set(node.responseKey || (node.id + 'Response'), payload);
      }
      await componentLoader.render(node, { state: state.getState(), setState: state.set });
      return state.getState();
    }

    async function run(nodes) {
      var queue = Array.isArray(nodes) ? nodes : [];
      for (var i = 0; i < queue.length; i += 1) {
        await executeNode(queue[i]);
      }
      return state.getState();
    }

    return { run: run, executeNode: executeNode };
  }

  global.LogicHubWorkflowRunner = { create: createWorkflowRunner };
})(window);
