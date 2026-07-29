(function (global) {
  function connectWorkspaceEvents(onMessage) {
    return global.LogicHubSDK.streamJob('workspace-events', onMessage);
  }
  global.LogicHubRuntimeEvents = { connectWorkspaceEvents };
})(window);
