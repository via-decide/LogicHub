(function (global) {
  'use strict';

  function defaultApiClient(request) {
    return fetch(request.url, {
      method: request.method || 'GET',
      headers: request.headers || {},
      body: request.body ? JSON.stringify(request.body) : undefined
    }).then(function (response) { return response.json(); });
  }

  function storageFor(type) {
    if (type === 'session' && global.sessionStorage) return global.sessionStorage;
    if (type === 'local' && global.localStorage) return global.localStorage;
    return null;
  }

  function createRuntimeEngine(options) {
    var config = options || {};
    var persistence = config.persistence || {};
    var storage = storageFor(persistence.storage || 'local');
    var storageKey = persistence.key || 'logichub:app-state';
    var persistedState = {};

    if (storage) {
      try {
        persistedState = JSON.parse(storage.getItem(storageKey) || '{}');
      } catch (error) {
        persistedState = {};
      }
    }

    var initialState = Object.assign({}, config.initialState || {}, persistedState || {});
    var stateManager = global.LogicHubStateManager.create(initialState, { maxHistory: config.maxStateHistory || 100 });
    var componentLoader = global.LogicHubComponentLoader.create(config.components);
    var workflowRunner = global.LogicHubWorkflowRunner.create({
      apiClient: config.apiClient || defaultApiClient,
      componentLoader: componentLoader,
      stateManager: stateManager
    });

    function savePersistedState() {
      if (!storage) return;
      var persistKeys = Array.isArray(persistence.keys) ? persistence.keys : [];
      var source = stateManager.getState();
      var payload = persistKeys.length
        ? persistKeys.reduce(function (result, key) {
          result[key] = source[key];
          return result;
        }, {})
        : source;
      storage.setItem(storageKey, JSON.stringify(payload));
    }

    function bindStateToDom(rootElement, nextState) {
      var boundNodes = rootElement.querySelectorAll('[data-state-bind]');
      for (var i = 0; i < boundNodes.length; i += 1) {
        var node = boundNodes[i];
        var path = node.getAttribute('data-state-bind');
        var value = stateManager.get(path);
        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') {
          node.value = value == null ? '' : value;
        } else {
          node.textContent = value == null ? '' : String(value);
        }
      }

      var modelNodes = rootElement.querySelectorAll('[data-state-model]');
      for (var j = 0; j < modelNodes.length; j += 1) {
        var modelNode = modelNodes[j];
        if (modelNode.dataset.stateBound) continue;
        modelNode.dataset.stateBound = '1';
        modelNode.addEventListener('input', function (event) {
          var target = event.target;
          var modelPath = target.getAttribute('data-state-model');
          stateManager.set(modelPath, target.value);
        });
      }

      rootElement.dataset.runtimeState = JSON.stringify(nextState);
    }

    function renderDevState(rootElement) {
      if (!rootElement) return;
      var state = stateManager.getState();
      var history = stateManager.history();
      rootElement.innerHTML = '<h1>LogicHub State Inspector</h1>' +
        '<h2>Current State</h2><pre>' + JSON.stringify(state, null, 2) + '</pre>' +
        '<h2>Recent Updates</h2><pre>' + JSON.stringify(history, null, 2) + '</pre>';
    }

    function mount(rootElement) {
      if (!rootElement) throw new Error('Runtime mount target is required.');
      stateManager.subscribe(function (nextState) {
        bindStateToDom(rootElement, nextState);
        savePersistedState();
        if (global.location && global.location.pathname.indexOf('/dev/state') !== -1) {
          renderDevState(rootElement);
        }
      });
      stateManager.patch(initialState || {});
    }

    return {
      mount: mount,
      run: workflowRunner.run,
      executeNode: workflowRunner.executeNode,
      registerComponent: componentLoader.register,
      getState: stateManager.getState,
      getStateValue: stateManager.get,
      setState: stateManager.set,
      updateState: stateManager.patch,
      subscribeState: stateManager.subscribe,
      getStateHistory: stateManager.history
    };
  }

  global.LogicHubRuntimeEngine = { create: createRuntimeEngine };
})(window);
