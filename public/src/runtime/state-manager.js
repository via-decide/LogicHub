(function (global) {
  'use strict';

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    if (Array.isArray(value)) {
      return value.map(clone);
    }
    if (isObject(value)) {
      var copy = {};
      Object.keys(value).forEach(function (key) {
        copy[key] = clone(value[key]);
      });
      return copy;
    }
    return value;
  }

  function merge(target, source) {
    var next = clone(target || {});
    Object.keys(source || {}).forEach(function (key) {
      if (isObject(source[key]) && isObject(next[key])) {
        next[key] = merge(next[key], source[key]);
      } else {
        next[key] = clone(source[key]);
      }
    });
    return next;
  }

  function toPath(path) {
    if (Array.isArray(path)) return path;
    if (typeof path !== 'string' || path.length === 0) return [];
    return path.split('.').filter(Boolean);
  }

  function getIn(source, path) {
    var segments = toPath(path);
    if (!segments.length) return source;
    var cursor = source;
    for (var i = 0; i < segments.length; i += 1) {
      if (cursor == null) return undefined;
      cursor = cursor[segments[i]];
    }
    return cursor;
  }

  function setIn(target, path, value) {
    var segments = toPath(path);
    if (!segments.length) {
      return clone(value);
    }

    var root = clone(target || {});
    var cursor = root;
    for (var i = 0; i < segments.length - 1; i += 1) {
      var key = segments[i];
      if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) {
        cursor[key] = {};
      }
      cursor[key] = clone(cursor[key]);
      cursor = cursor[key];
    }
    cursor[segments[segments.length - 1]] = clone(value);
    return root;
  }

  function createStateManager(initialState, options) {
    var config = options || {};
    var state = merge({}, initialState || {});
    var listeners = [];
    var history = [];
    var maxHistory = config.maxHistory || 100;

    function snapshot() { return clone(state); }

    function notify(change) {
      var currentState = snapshot();
      listeners.forEach(function (entry) {
        if (!entry.path || change.path === entry.path || entry.path.indexOf(change.path + '.') === 0 || change.path.indexOf(entry.path + '.') === 0) {
          entry.listener(currentState, change);
        }
      });
    }

    function record(change) {
      history.push({
        timestamp: new Date().toISOString(),
        path: change.path,
        value: clone(change.value),
        type: change.type
      });
      if (history.length > maxHistory) {
        history = history.slice(history.length - maxHistory);
      }
    }

    function getState() { return snapshot(); }
    function get(path) { return clone(getIn(state, path)); }

    function set(path, value) {
      var changePath = typeof path === 'string' ? path : '';
      state = setIn(state, changePath, value);
      var change = { type: 'set', path: changePath, value: value };
      record(change);
      notify(change);
      return snapshot();
    }

    function patch(nextState) {
      state = merge(state, nextState || {});
      var change = { type: 'patch', path: '', value: nextState || {} };
      record(change);
      notify(change);
      return snapshot();
    }

    function subscribe(pathOrListener, maybeListener) {
      var entry = typeof pathOrListener === 'function'
        ? { path: '', listener: pathOrListener }
        : { path: pathOrListener || '', listener: maybeListener };
      listeners.push(entry);
      return function unsubscribe() {
        listeners = listeners.filter(function (item) { return item !== entry; });
      };
    }

    function historySnapshot() {
      return clone(history);
    }

    return {
      getState: getState,
      get: get,
      set: set,
      patch: patch,
      subscribe: subscribe,
      history: historySnapshot
    };
  }

  global.LogicHubStateManager = { create: createStateManager };
})(window);
