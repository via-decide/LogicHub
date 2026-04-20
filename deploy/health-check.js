#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'build';
const rootDir = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(rootDir, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(rootDir, file));
}

function logOk(message) {
  console.log(`✅ ${message}`);
}

function logWarn(message) {
  console.log(`⚠ ${message}`);
}

function logFail(message) {
  console.error(`❌ ${message}`);
}

function checkUiLoads() {
  if (!exists('index.html')) throw new Error('index.html is missing.');
  const html = read('index.html');
  if (!/<body[\s>]/i.test(html)) throw new Error('index.html missing <body>.');
  if (!html.includes('id="canvas"')) throw new Error('Builder canvas container (#canvas) not found.');
  logOk('UI shell and builder canvas markup detected in index.html.');
}

function checkApiEndpoints() {
  const endpoints = [
    'api/access-status.js',
    'api/founder-request.js',
    'api/publish-app.js',
    'api/build-apk.js'
  ];
  const missing = endpoints.filter((file) => !exists(file));
  if (missing.length) {
    throw new Error(`Missing API handlers: ${missing.join(', ')}`);
  }
  logOk('Expected API handlers exist for access, founder, publish, and APK routes.');
}

async function checkRemoteApiReachability() {
  const baseUrl = process.env.PUBLIC_SITE_URL || process.env.PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    logWarn('Skipping live API probe (set PUBLIC_SITE_URL to enable).');
    return;
  }

  const normalized = baseUrl.replace(/\/$/, '');
  const url = `${normalized}/api/access-status`;
  try {
    const response = await fetch(url, { method: 'GET' });
    if (response.status >= 500) {
      throw new Error(`Server returned ${response.status}`);
    }
    logOk(`Live API probe reached ${url} (status ${response.status}).`);
  } catch (error) {
    throw new Error(`Unable to reach ${url}: ${error.message}`);
  }
}

function checkStaticAssetsRelative() {
  const htmlFiles = ['index.html', 'pages/index.html', 'blueprints/index.html'].filter(exists);
  const badLinks = [];

  for (const file of htmlFiles) {
    const html = read(file);
    const matches = html.match(/(?:src|href)=['"]\/(?!\/)([^'"]+)['"]/g) || [];
    if (matches.length) {
      badLinks.push(`${file}: ${matches.join(', ')}`);
    }
  }

  if (badLinks.length) {
    throw new Error(`Found absolute asset paths. ${badLinks.join(' | ')}`);
  }

  logOk('Static HTML files do not use absolute-root asset paths.');
}

function checkBuilderCanvasLoads() {
  const html = read('index.html');
  const hasCanvas = html.includes('id="canvas"');
  const hasMap = html.includes('map: new LogicMap()') || html.includes('this.map = new LogicMap()');
  if (!hasCanvas || !hasMap) {
    throw new Error('Builder bootstrap markers missing from index.html.');
  }
  logOk('Builder canvas bootstrap markers are present.');
}

async function run() {
  try {
    checkUiLoads();
    checkApiEndpoints();
    checkBuilderCanvasLoads();
    checkStaticAssetsRelative();

    if (mode === 'deployment' || mode === 'full') {
      await checkRemoteApiReachability();
    } else {
      logWarn('Remote endpoint probe skipped in build mode. Use --mode=deployment to enable.');
    }

    console.log('✅ Deployment health-check passed.');
  } catch (error) {
    logFail(error.message || String(error));
    process.exitCode = 1;
  }
}

run();
