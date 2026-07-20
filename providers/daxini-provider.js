(function (global) {
  global.LogicHubAuth = global.LogicHubAuth || { getToken: () => global.localStorage?.getItem('daxini_jwt') || '' };
  global.LogicHubWorkspace = global.LogicHubWorkspace || { id: global.localStorage?.getItem('daxini_workspace_id') || 'default' };
})(window);
