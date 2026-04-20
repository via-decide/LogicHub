(function (global) {
  const MAX_JS_BYTES = 512 * 1024;

  function hasUnsafeScript(html) {
    const inlineScriptMatches = String(html || '').match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
    return inlineScriptMatches.some((block) => /eval\s*\(|new\s+Function\s*\(|document\.write\s*\(/i.test(block));
  }

  function validateProjectBundle(bundle) {
    const files = bundle && bundle.app ? bundle.app : {};
    const required = ['index.html', 'app.js', 'style.css', 'manifest.json', 'sw.js', 'metadata.json'];
    const missing = required.filter((name) => !files[name]);
    if (missing.length) throw new Error(`Missing required bundle files: ${missing.join(', ')}`);
    if (!/<html[\s>]/i.test(files['index.html'])) throw new Error('index.html must include an <html> root element.');
    if (!/<body[\s>]/i.test(files['index.html'])) throw new Error('index.html must include a <body> element.');
    if (new Blob([files['app.js']]).size > MAX_JS_BYTES) throw new Error('app.js exceeds the 512KB publish size limit.');
    if (hasUnsafeScript(files['index.html']) || /eval\s*\(|new\s+Function\s*\(/i.test(files['app.js'])) {
      throw new Error('Unsafe script execution pattern detected. Remove eval/new Function usage.');
    }
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `app-${Date.now()}`;
  }

  function buildPublishBundle(app, appName) {
    const files = app.collectProjectFiles({ pwa: true });
    const metadata = {
      name: appName,
      creator: app.serverAccess?.email || app.authState?.email || 'username',
      created_from: 'logichub',
      category: 'tool',
      version: '1.0',
      slug: slugify(appName),
      description: app.map.buildPRD().slice(0, 280)
    };

    const bundle = {
      app: {
        'index.html': files['index.html'] || '<!doctype html><html><body><h1>App</h1></body></html>',
        'app.js': files['app.js'] || '',
        'style.css': files['styles.css'] || files['style.css'] || '',
        'manifest.json': files['manifest.json'] || app.buildDefaultManifest(appName),
        'sw.js': files['sw.js'] || app.buildDefaultServiceWorker(),
        'metadata.json': JSON.stringify(metadata, null, 2)
      },
      architecture_prd: app.map.buildPRD()
    };

    validateProjectBundle(bundle);
    return { bundle, slug: metadata.slug, metadata };
  }

  global.LogicHubDeployClient = {
    buildPublishBundle,
    validateProjectBundle,
    slugify
  };
})(window);
