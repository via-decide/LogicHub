(function (global) {
  'use strict';

  function buildRuntimeScript(runtimePackage) {
    var payload = JSON.stringify({
      appConfig: runtimePackage.appConfig,
      components: runtimePackage.components,
      executionPlan: runtimePackage.executionPlan
    });

    return [
      '(function(){',
      "  'use strict';",
      '  var app = ' + payload + ';',
      "  var root = document.getElementById('app');",
      "  if (!root) throw new Error('Missing #app container');",
      "  var title = document.createElement('h1');",
      "  title.textContent = app.appConfig.appName + ' (' + app.appConfig.outputType + ')';",
      '  root.appendChild(title);',
      "  var list = document.createElement('ol');",
      '  app.components.forEach(function(component){',
      "    var li = document.createElement('li');",
      "    li.textContent = component.title + ' [' + component.type + ']';",
      '    list.appendChild(li);',
      '  });',
      '  root.appendChild(list);',
      "  var status = document.createElement('p');",
      "  status.textContent = 'Runnable build generated with ' + app.components.length + ' compiled components.';",
      '  root.appendChild(status);',
      '})();'
    ].join('\n');
  }

  function packageRuntime(bundle, config) {
    var indexHtml = [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      '  <title>' + config.appName + '</title>',
      '  <style>body{font-family:Arial,sans-serif;margin:24px;}li{margin:6px 0;}</style>',
      '</head>',
      '<body>',
      '  <main id="app"></main>',
      '  <script src="./app.js"></script>',
      '</body>',
      '</html>'
    ].join('\n');

    var appJs = buildRuntimeScript({
      appConfig: config,
      components: bundle.components,
      executionPlan: bundle.executionPlan
    });

    return {
      appConfig: config,
      components: bundle.components,
      executionPlan: bundle.executionPlan,
      files: {
        'index.html': indexHtml,
        'app.js': appJs,
        'app-config.json': JSON.stringify(config, null, 2)
      }
    };
  }

  global.LogicHubRuntimePackager = {
    packageRuntime: packageRuntime
  };
})(window);
