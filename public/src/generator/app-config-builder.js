(function (global) {
  'use strict';

  var SUPPORTED_OUTPUT_TYPES = ['web-app', 'dashboard', 'automation-tool', 'research-tool'];

  function normalizeOutputType(requestedType) {
    if (!requestedType) return 'web-app';
    var normalized = String(requestedType).toLowerCase().replace(/\s+/g, '-');
    if (normalized === 'web-apps') normalized = 'web-app';
    if (normalized === 'dashboards') normalized = 'dashboard';
    if (normalized === 'automation-tools') normalized = 'automation-tool';
    if (normalized === 'research-tools') normalized = 'research-tool';
    return SUPPORTED_OUTPUT_TYPES.indexOf(normalized) >= 0 ? normalized : 'web-app';
  }

  function inferOutputType(workflow) {
    var title = String(workflow && workflow.task && workflow.task.title || '').toLowerCase();
    if (title.indexOf('dashboard') >= 0) return 'dashboard';
    if (title.indexOf('automation') >= 0 || title.indexOf('automate') >= 0) return 'automation-tool';
    if (title.indexOf('research') >= 0 || title.indexOf('analysis') >= 0) return 'research-tool';
    return 'web-app';
  }

  function buildConfig(workflow, options) {
    var safeOptions = options || {};
    var outputType = normalizeOutputType(safeOptions.outputType || inferOutputType(workflow));

    return {
      appId: safeOptions.appId || 'logic-app-' + Date.now(),
      appName: safeOptions.appName || ((workflow && workflow.task && workflow.task.title) || 'LogicHub Generated App'),
      outputType: outputType,
      runtimeVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      deploymentTarget: safeOptions.deploymentTarget || 'static-browser'
    };
  }

  global.LogicHubAppConfigBuilder = {
    buildConfig: buildConfig,
    normalizeOutputType: normalizeOutputType,
    inferOutputType: inferOutputType
  };
})(window);
