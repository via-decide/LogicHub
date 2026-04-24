(function (global) {
  'use strict';
  function ensureTracker() { if (!global.LogicHubVersionTracker) throw new Error('LogicHubVersionTracker is required.'); }
  function normalizeRelease(appId, build, metadata) {
    ensureTracker();
    var entry = global.LogicHubVersionTracker.trackUpdate(appId, build, metadata);
    return { appId: entry.appId, version: entry.version, releasedAt: entry.createdAt, changedFiles: entry.changes, files: Object.keys((entry.snapshot || {}).files || {}), metadata: entry.meta };
  }
  function listReleases(appId) {
    ensureTracker();
    return global.LogicHubVersionTracker.getHistory(appId).map(function (entry) {
      return { version: entry.version, createdAt: entry.createdAt, changedFiles: entry.changes, metadata: entry.meta };
    });
  }
  global.LogicHubReleaseManager = { createRelease: normalizeRelease, listReleases: listReleases };
})(window);
