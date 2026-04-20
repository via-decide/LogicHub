(function (global) {
  const MAX_JS_BYTES = 512 * 1024;

  function hasUnsafeScript(html) {
    const inlineScriptMatches = String(html || '').match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
    return inlineScriptMatches.some((block) => /eval\s*\(|new\s+Function\s*\(|document\.write\s*\(/i.test(block));
  }

  function validateProjectBundle(bundle) {
    const files = bundle && bundle.build ? bundle.build : {};
    const required = ['index.html', 'app.js', 'style.css', 'manifest.json', 'metadata.json'];
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
      origin: 'logichub',
      version: '1.0',
      slug: slugify(appName),
      description: app.map.buildPRD().slice(0, 280)
    };

    const bundle = {
      build: {
        'index.html': files['index.html'] || '<!doctype html><html><body><h1>App</h1></body></html>',
        'app.js': files['app.js'] || '',
        'style.css': files['styles.css'] || files['style.css'] || '',
        'manifest.json': files['manifest.json'] || app.buildDefaultManifest(appName),
        'metadata.json': JSON.stringify(metadata, null, 2)
      },
      architecture_prd: app.map.buildPRD()
    };

    validateProjectBundle(bundle);
    return { bundle, slug: metadata.slug, metadata };
  }


  function ensureDeploymentErrorOverlay() {
    if (global.__logicHubDeploymentOverlayAttached) return;
    global.__logicHubDeploymentOverlayAttached = true;

    function renderOverlay(message) {
      if (!global.document || global.document.getElementById('deployment-error-overlay')) return;
      const overlay = global.document.createElement('div');
      overlay.id = 'deployment-error-overlay';
      overlay.setAttribute('role', 'alert');
      overlay.style.cssText = [
        'position:fixed','inset:0','z-index:99999','display:flex','align-items:center','justify-content:center',
        'background:rgba(3,5,8,0.92)','color:#fff','font-family:Inter,system-ui,sans-serif','padding:1rem'
      ].join(';');
      overlay.innerHTML = `
        <div style="max-width:640px;border:1px solid rgba(255,68,68,0.5);border-radius:14px;padding:1rem 1.1rem;background:#0a0c10;box-shadow:0 12px 40px rgba(0,0,0,0.45)">
          <h2 style="margin:0 0 .5rem;font-size:1.05rem;color:#ff6969">Deployment error</h2>
          <p style="margin:.25rem 0 .4rem;line-height:1.45">${message || 'An unexpected runtime error occurred while loading this deployment.'}</p>
          <p style="margin:0;opacity:.85;font-size:.9rem">Check build logs and verify environment variables before retrying deployment.</p>
        </div>
      `;
      global.document.body.appendChild(overlay);
    }

    global.addEventListener('error', (event) => {
      const details = event?.error?.message || event?.message || 'Script execution failed during startup.';
      renderOverlay(details);
    });

    global.addEventListener('unhandledrejection', (event) => {
      const reason = event?.reason;
      const details = typeof reason === 'string' ? reason : (reason?.message || 'Unhandled promise rejection during startup.');
      renderOverlay(details);
    });
  }

  ensureDeploymentErrorOverlay();

  global.LogicHubDeployClient = {
    buildPublishBundle,
    validateProjectBundle,
    slugify
  };
})(window);
