(function (global) {
  'use strict';
  function ensureDependencies() {
    if (!global.LogicHubVersionTracker) throw new Error('LogicHubVersionTracker is required.');
    if (!global.LogicHubReleaseManager) throw new Error('LogicHubReleaseManager is required.');
  }
  function rollbackTo(appId, version) {
    ensureDependencies();
    var target = global.LogicHubVersionTracker.getByVersion(appId, version);
    if (!target) throw new Error('Requested version not found: ' + version);
    return { appId: target.appId, rolledBackTo: target.version, restoredAt: new Date().toISOString(), snapshot: target.snapshot, availableReleases: global.LogicHubReleaseManager.listReleases(appId) };
  }
  function latestSnapshot(appId) {
    ensureDependencies();
    var history = global.LogicHubVersionTracker.getHistory(appId);
    return history.length ? history[history.length - 1].snapshot : null;
  }
  global.LogicHubRollbackEngine = { rollbackTo: rollbackTo, latestSnapshot: latestSnapshot };
})(window);
