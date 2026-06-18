#!/usr/bin/env node

const baseUrl = (process.env.DEPLOY_BASE_URL || process.env.SITE_URL || 'http://localhost:4173').replace(/\/$/, '');
const apiBase = (process.env.API_BASE_URL || `${baseUrl}/api`).replace(/\/$/, '');

async function checkUi() {
  const res = await fetch(baseUrl);
  if (!res.ok) throw new Error(`UI check failed: HTTP ${res.status}`);
  const html = await res.text();
  if (!html.includes('id="canvas"')) {
    throw new Error('Builder canvas marker (#canvas) not found in HTML response.');
  }
  console.log('✓ UI loads and includes builder canvas');
}

async function checkEndpoint(path, optional = true) {
  const url = `${apiBase}${path}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (res.status >= 500) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    const bodyPreview = (await res.text()).slice(0, 200).toLowerCase();
    const looksLikeSpaFallback = contentType.includes('text/html') || bodyPreview.includes('<!doctype html') || bodyPreview.includes('<html');
    if ((res.status === 404 || looksLikeSpaFallback) && optional) {
      console.log(`• Optional endpoint missing on static host: ${url}`);
      return;
    }
    console.log(`✓ Endpoint reachable: ${url} (HTTP ${res.status})`);
  } catch (error) {
    if (optional) {
      console.log(`• Optional endpoint check skipped/failed: ${url} (${error.message})`);
      return;
    }
    throw error;
  }
}

(async () => {
  try {
    await checkUi();
    await checkEndpoint('/access-status', true);
    await checkEndpoint('/public-feed', true);
    console.log('Health check complete.');
  } catch (error) {
    console.error(`Health check failed: ${error.message}`);
    process.exit(1);
  }
})();
