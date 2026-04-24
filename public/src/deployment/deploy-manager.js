(function (global) {
  'use strict';
  function toPackage(build) { var files = []; Object.keys((build && build.files) || {}).forEach(function (name) { var content = build.files[name] || ''; files.push({ name: name, size: content.length, content: content }); }); return { appName: (build && build.appConfig && build.appConfig.appName) || 'LogicHub App', files: files, createdAt: new Date().toISOString() }; }
  function getAdapters() { var map = {}; [global.LogicHubMarketplaceAdapter, global.LogicHubVercelAdapter, global.LogicHubCloudflareAdapter].forEach(function (a) { if (a && a.key && typeof a.deploy === 'function') map[a.key] = a; }); return map; }
  function deploy(target, build, options) { var adapters = getAdapters(); if (!adapters[target]) return Promise.reject(new Error('Unsupported deployment target: ' + target)); var pkg = toPackage(build); var logs = ['Packaging build for ' + target, 'Package created with ' + pkg.files.length + ' files']; return adapters[target].deploy(pkg, options || {}).then(function (result) { result.logs = logs.concat(result.logs || []); return result; }); }
  function oneClickDeploy(target, source, options) { var build = source && source.deployableBuild ? source.deployableBuild : source; return deploy(target, build || { files: {} }, options || {}); }
  global.LogicHubDeployManager = { deployTargets: ['daxini-space', 'vercel', 'cloudflare-pages'], deploy: deploy, oneClickDeploy: oneClickDeploy, packageBuild: toPackage };
})(window);
