(function (global) {
  'use strict';

  function withDefaultOptions(options) {
    var config = options || {};
    return {
      wait: config.wait || function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms || 0); }); },
      now: config.now || function () { return Date.now(); },
      state: config.state || {},
      apiClient: config.apiClient || function (request) {
        return fetch(request.url, {
          method: request.method || 'GET',
          headers: request.headers || {},
          body: request.body ? JSON.stringify(request.body) : undefined
        }).then(function (response) { return response.json(); });
      },
      notify: config.notify || function (message) {
        if (typeof window !== 'undefined' && window.alert && message) window.alert(String(message));
      },
      redirect: config.redirect || function (page) {
        if (typeof window !== 'undefined' && window.location && page) window.location.assign(page);
      },
      saveData: config.saveData || function (action, context) {
        var key = action.table || action.key || 'data';
        context.state[key] = Object.assign({}, context.payload || {});
        return context.state[key];
      },
      sendEmail: config.sendEmail || function (action) { return Promise.resolve({ queued: true, to: action.to || '' }); },
      runScript: config.runScript || function (action, context) {
        if (typeof action.fn === 'function') return action.fn(context);
        return null;
      }
    };
  }

  function setPath(target, dottedPath, value) {
    if (!dottedPath) return;
    var keys = String(dottedPath).split('.');
    var cursor = target;
    for (var i = 0; i < keys.length - 1; i += 1) {
      if (!cursor[keys[i]] || typeof cursor[keys[i]] !== 'object') cursor[keys[i]] = {};
      cursor = cursor[keys[i]];
    }
    cursor[keys[keys.length - 1]] = value;
  }

  function runAction(action, context, options, logs, isOnErrorFlow) {
    var startedAt = options.now();
    function append(status, details) {
      logs.push({
        id: action.id,
        type: action.type,
        title: action.title || action.type,
        status: status,
        startedAt: startedAt,
        endedAt: options.now(),
        details: details || null,
        onErrorFlow: Boolean(isOnErrorFlow)
      });
    }

    function executeNested(actions) {
      var nested = Array.isArray(actions) ? actions : [];
      var cursor = Promise.resolve(context);
      nested.forEach(function (nestedAction) {
        cursor = cursor.then(function () { return runAction(nestedAction, context, options, logs, isOnErrorFlow); });
      });
      return cursor;
    }

    return Promise.resolve()
      .then(function () {
        if (action.type === 'saveData') return options.saveData(action, context);
        if (action.type === 'updateState') return setPath(options.state, action.key, action.value);
        if (action.type === 'callApi') return options.apiClient(action.request || {});
        if (action.type === 'showNotification') return options.notify(action.message || action.title || 'Workflow notification');
        if (action.type === 'redirect') return options.redirect(action.page || action.url);
        if (action.type === 'toggleUi') return setPath(options.state, action.key, Boolean(action.value));
        if (action.type === 'sendEmail') return options.sendEmail(action, context);
        if (action.type === 'runScript') return options.runScript(action, context);
        if (action.type === 'condition') {
          var whenTrue = Boolean(context.payload && context.payload[action.condition]);
          return executeNested(whenTrue ? action.then : action.else);
        }
        if (action.type === 'loop') {
          var list = context.payload && context.payload[action.listPath];
          if (!Array.isArray(list)) return null;
          var seq = Promise.resolve();
          list.forEach(function (item, index) {
            seq = seq.then(function () {
              context.loop = { index: index, item: item };
              return executeNested(action.actions);
            });
          });
          return seq;
        }
        if (action.type === 'timer') return options.wait(action.ms || 0);
        throw new Error('Unsupported action type: ' + action.type);
      })
      .then(function (result) {
        if (action.responseKey) setPath(options.state, action.responseKey, result);
        append('success', result);
      })
      .catch(function (error) {
        append('error', error && error.message ? error.message : String(error));
        if (Array.isArray(action.onError) && action.onError.length) {
          return runSequence(action.onError, context, options, logs, true);
        }
        throw error;
      });
  }

  function runSequence(actions, context, options, logs, isOnErrorFlow) {
    var queue = Array.isArray(actions) ? actions : [];
    var cursor = Promise.resolve(context);
    queue.forEach(function (action) {
      cursor = cursor.then(function () {
        return runAction(action, context, options, logs, isOnErrorFlow);
      });
    });
    return cursor;
  }

  function runWorkflow(workflow, payload, options) {
    var config = withDefaultOptions(options);
    var context = { payload: payload || {}, state: config.state };
    var logs = [];
    return runSequence((workflow && workflow.actions) || [], context, config, logs, false)
      .then(function () {
        return { ok: true, state: config.state, logs: logs };
      })
      .catch(function (error) {
        return { ok: false, state: config.state, logs: logs, error: error && error.message ? error.message : String(error) };
      });
  }

  function run(plan, handlers, initialPayload) {
    var cursor = Promise.resolve({ payload: initialPayload || {}, logs: [] });
    plan.steps.forEach(function (step) {
      cursor = cursor.then(function (state) {
        var handler = handlers && handlers[step.type] ? handlers[step.type] : defaultHandler;
        return Promise.resolve(handler(step, state.payload)).then(function (payload) {
          state.payload = payload;
          state.logs.push(step.index + '. ' + step.title + ' [' + step.type + ']');
          return state;
        });
      });
    });
    return cursor;
  }

  function defaultHandler(step, payload) { return Object.assign({}, payload, { lastStep: step.id, lastType: step.type }); }

  global.LogicHubWorkflowRuntime = {
    run: run,
    runWorkflow: runWorkflow,
    runAction: runAction
  };
})(window);
