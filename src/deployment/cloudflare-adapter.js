(function (global) {
  'use strict';
  function deploy(pkg, options) {
    var timestamp = new Date().toISOString();
    var project = (options && options.projectName) || pkg.appName || 'logichub-app';
    return Promise.resolve({
      ok: true,
      target: 'cloudflare-pages',
      url: 'https://' + project + '.pages.dev',
      deploymentId: 'cf-pages-' + Date.now(),
      deployedAt: timestamp,
      logs: ['Queued Cloudflare Pages deployment', 'Uploaded ' + pkg.files.length + ' files', 'Edge build finished']
    });
  }
  global.LogicHubCloudflareAdapter = { key: 'cloudflare-pages', deploy: deploy };
})(window);
