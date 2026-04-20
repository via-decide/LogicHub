(function (global) {
  'use strict';

  function defaultApiClient(request) {
    return fetch(request.url, {
      method: request.method || 'GET',
      headers: request.headers || {},
      body: request.body ? JSON.stringify(request.body) : undefined
    }).then(function (response) { return response.json(); });
  }

  function createRuntimeEngine(options) {
    var config = options || {};
    var stateManager = global.LogicHubStateManager.create(config.initialState);
    var componentLoader = global.LogicHubComponentLoader.create(config.components);
    var workflowRunner = global.LogicHubWorkflowRunner.create({
      apiClient: config.apiClient || defaultApiClient,
      componentLoader: componentLoader,
      stateManager: stateManager
    });

    function mount(rootElement) {
      if (!rootElement) throw new Error('Runtime mount target is required.');
      stateManager.subscribe(function (nextState) {
        rootElement.dataset.runtimeState = JSON.stringify(nextState);
      });
      stateManager.patch(config.initialState || {});
    }

    return {
      mount: mount,
      run: workflowRunner.run,
      executeNode: workflowRunner.executeNode,
      registerComponent: componentLoader.register,
      getState: stateManager.getState,
      setState: stateManager.set
    };
  }

  global.LogicHubRuntimeEngine = { create: createRuntimeEngine };
})(window);
