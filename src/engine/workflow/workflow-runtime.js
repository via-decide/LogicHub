(function (global) {
  'use strict';

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
  global.LogicHubWorkflowRuntime = { run: run };
})(window);
