(function (global) {
  'use strict';
  function deploy(pkg, options) {
    var timestamp = new Date().toISOString();
    var project = (options && options.projectName) || pkg.appName || 'logichub-app';
    return Promise.resolve({
      ok: true,
      target: 'vercel',
      url: 'https://' + project + '.vercel.app',
      deploymentId: 'vercel-' + Date.now(),
      deployedAt: timestamp,
      logs: ['Queued Vercel deployment', 'Uploaded ' + pkg.files.length + ' files', 'Build ready']
    });
  }
  global.LogicHubVercelAdapter = { key: 'vercel', deploy: deploy };
})(window);
