(function (global) {
  'use strict';
  var store = {};
  function copy(value) { return JSON.parse(JSON.stringify(value || {})); }
  function nextVersion(history) { var prev = history.length ? String(history[history.length - 1].version) : '0.0.0'; var p = prev.split('.').map(function (n) { return Number(n) || 0; }); return [p[0], p[1], p[2] + 1].join('.'); }
  function diffFiles(previous, current) { var keys = Object.keys(Object.assign({}, previous || {}, current || {})); return keys.filter(function (name) { return (previous || {})[name] !== (current || {})[name]; }); }
  function trackUpdate(appId, snapshot, meta) {
    var id = String(appId || '').trim(); if (!id) throw new Error('appId is required');
    if (!store[id]) store[id] = [];
    var history = store[id], previous = history.length ? history[history.length - 1].snapshot.files : {};
    var entry = { appId: id, version: nextVersion(history), createdAt: new Date().toISOString(), changes: diffFiles(previous, (snapshot || {}).files), meta: copy(meta), snapshot: copy(snapshot) };
    history.push(entry); return copy(entry);
  }
  function history(appId) { return copy(store[String(appId || '').trim()] || []); }
  function byVersion(appId, version) { var list = store[String(appId || '').trim()] || []; var found = list.find(function (entry) { return entry.version === version; }); return found ? copy(found) : null; }
  global.LogicHubVersionTracker = { trackUpdate: trackUpdate, getHistory: history, getByVersion: byVersion };
})(window);
