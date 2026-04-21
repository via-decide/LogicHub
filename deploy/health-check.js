#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'deployment';
const isBuild = mode === 'build';
const isDeployment = mode === 'deployment';
const rootDir = process.cwd();

console.log(`\n🔍 Running health checks (mode: ${mode})...\n`);

let passed = 0;
let failed = 0;

const fromRoot = (...segments) => path.join(rootDir, ...segments);

function checkUiShell() {
  const indexPath = fromRoot('index.html');
  if (!fs.existsSync(indexPath)) {
    console.log('❌ index.html is missing.');
    failed += 1;
    return;
  }

  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  if (indexHtml.includes('id="canvas"') && indexHtml.includes('id="map-status"')) {
    console.log('✅ UI shell and builder canvas markup detected in index.html.');
    passed += 1;
  } else {
    console.log('❌ UI shell or builder canvas markup missing.');
    failed += 1;
  }
}

function checkApiHandlers() {
  const requiredHandlers = [
    'access-status.js',
    'founder-request.js',
    'publish-app.js',
    'build-apk.js'
  ];

  let handlersOk = true;
  for (const handler of requiredHandlers) {
    if (!fs.existsSync(fromRoot('api', handler))) {
      console.log(`❌ Missing API handler: ${handler}`);
      handlersOk = false;
      failed += 1;
    }
  }

  if (handlersOk) {
    console.log('✅ Expected API handlers exist for access, founder, publish, and APK routes.');
    passed += 1;
  }
}

function checkBuilderCanvasBootstrap() {
  const indexHtml = fs.readFileSync(fromRoot('index.html'), 'utf-8');
  if (indexHtml.includes('id="canvas"') && indexHtml.includes('new LogicMap()')) {
    console.log('✅ Builder canvas bootstrap markers are present.');
    passed += 1;
  } else {
    console.log('⚠ Builder canvas bootstrap markers may be incomplete.');
  }
}

function checkAssetPaths() {
  const htmlFiles = ['index.html', 'pages/index.html', 'blueprints/index.html'];
  let absolutePathsFound = false;

  for (const file of htmlFiles) {
    const filePath = fromRoot(file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('src="/') || content.includes("src='/") || content.includes('href="/') || content.includes("href='/")) {
      absolutePathsFound = true;
    }
  }

  if (!absolutePathsFound) {
    console.log('✅ Static HTML files do not use absolute-root asset paths.');
    passed += 1;
  } else {
    console.log('⚠ Some files may use absolute paths.');
  }
}

function checkPublicDirectory() {
  if (!isBuild) return;

  const publicDir = fromRoot('public');
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    console.log(`✅ Public directory exists with ${files.length} items.`);
    passed += 1;
  } else {
    console.log('❌ Public directory does not exist!');
    failed += 1;
  }
}

async function checkRemoteProbe() {
  if (!isDeployment) {
    console.log('⚠ Remote endpoint probe skipped in build mode. Use --mode=deployment to enable.');
    return;
  }

  const baseUrl = process.env.PUBLIC_SITE_URL || process.env.PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    console.log('⚠ Remote endpoint probe requires active deployment.');
    return;
  }

  try {
    const normalized = baseUrl.replace(/\/$/, '');
    const response = await fetch(`${normalized}/api/access-status`);
    if (response.status >= 500) {
      throw new Error(`Server returned ${response.status}`);
    }
    console.log('✅ Remote endpoint probe succeeded.');
    passed += 1;
  } catch (error) {
    console.log(`❌ Remote endpoint probe failed: ${error.message}`);
    failed += 1;
  }
}

async function run() {
  checkUiShell();
  checkApiHandlers();
  checkBuilderCanvasBootstrap();
  checkAssetPaths();
  checkPublicDirectory();
  await checkRemoteProbe();

  console.log(`\n📊 Health Check Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.error('❌ Deployment health-check FAILED');
    process.exit(1);
  }

  console.log('✅ Deployment health-check passed.');
}

run();
