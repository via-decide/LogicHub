(function (global) {
  'use strict';

  function createWorkflowRunner(options) {
    var apiClient = options.apiClient;
    var componentLoader = options.componentLoader;
    var state = options.stateManager;
    var workflowStore = {};

    function registerWorkflow(workflow) {
      if (!workflow || !workflow.id) return;
      workflowStore[workflow.id] = workflow;
    }

    function getWorkflow(id) {
      return workflowStore[id] || null;
    }

    function findByTrigger(triggerName) {
      return Object.keys(workflowStore).map(function (id) { return workflowStore[id]; }).filter(function (workflow) {
        return workflow.trigger === triggerName;
      });
    }

    async function executeNode(node) {
      if (node.action === 'api' && node.request) {
        var payload = await apiClient(node.request, state.getState());
        state.set(node.responsePath || node.responseKey || (node.id + 'Response'), payload);
      }

      if (node.action === 'setState' && node.path) {
        state.set(node.path, node.value);
      }

      if (node.action === 'patchState' && node.state) {
        state.patch(node.state);
      }

      await componentLoader.render(node, {
        state: state.getState(),
        getState: state.get,
        setState: state.set,
        updateState: state.patch
      });
      return state.getState();
    }

    async function run(nodes) {
      var queue = Array.isArray(nodes) ? nodes : [];
      for (var i = 0; i < queue.length; i += 1) {
        await executeNode(queue[i]);
      }
      return state.getState();
    }

    function runWorkflow(workflowOrId, payload) {
      var workflow = typeof workflowOrId === 'string' ? getWorkflow(workflowOrId) : workflowOrId;
      return global.LogicHubWorkflowRuntime.runWorkflow(workflow, payload, {
        state: state.getState(),
        apiClient: apiClient,
        saveData: function (action, context) {
          state.set(action.table || action.key || 'data', Object.assign({}, context.payload || {}));
          return state.get(action.table || action.key || 'data');
        },
        notify: function (message) {
          state.set('ui.notification', message);
        },
        redirect: function (page) {
          state.set('ui.redirect', page);
        }
      }).then(function (result) {
        state.patch(result.state || {});
        return result;
      });
    }

    function trigger(eventName, payload) {
      var matching = findByTrigger(eventName);
      var cursor = Promise.resolve([]);
      matching.forEach(function (workflow) {
        cursor = cursor.then(function (results) {
          return runWorkflow(workflow, payload).then(function (result) {
            results.push({ workflowId: workflow.id, result: result });
            return results;
          });
        });
      });
      return cursor;
    }

    return {
      run: run,
      executeNode: executeNode,
      runWorkflow: runWorkflow,
      registerWorkflow: registerWorkflow,
      getWorkflow: getWorkflow,
      trigger: trigger
    };
  }

  global.LogicHubWorkflowRunner = { create: createWorkflowRunner };
})(window);
