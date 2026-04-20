(function (global) {
  'use strict';

  function createStateManager(initialState) {
    var state = Object.assign({}, initialState || {});
    var listeners = [];

    function getState() { return Object.assign({}, state); }
    function get(key) { return state[key]; }
    function set(key, value) {
      state[key] = value;
      listeners.forEach(function (listener) { listener(getState(), key, value); });
    }
    function patch(nextState) {
      Object.keys(nextState || {}).forEach(function (key) { set(key, nextState[key]); });
      return getState();
    }
    function subscribe(listener) {
      listeners.push(listener);
      return function unsubscribe() {
        listeners = listeners.filter(function (item) { return item !== listener; });
      };
    }

    return { getState: getState, get: get, set: set, patch: patch, subscribe: subscribe };
  }

  global.LogicHubStateManager = { create: createStateManager };
})(window);
