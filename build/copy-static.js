#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const copyTargets = [
  'index.html',
  'pages',
  'blueprints',
  'src',
  'api',
  'js',
  'components',
  'icons',
  'templates',
  'docs',
  'README.md'
];

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  console.log('✅ Created public directory');
} else {
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  console.log('✅ Reset public directory');
}

for (const target of copyTargets) {
  const source = path.join(ROOT_DIR, target);
  const destination = path.join(PUBLIC_DIR, target);

  if (!fs.existsSync(source)) {
    continue;
  }

  copyRecursively(source, destination);
  console.log(`✅ Copied ${target}`);
}

console.log('✅ Static files copied successfully');

function copyRecursively(source, destination) {
  const stats = fs.statSync(source);

  if (stats.isDirectory()) {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    for (const entry of fs.readdirSync(source)) {
      copyRecursively(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }

  fs.copyFileSync(source, destination);
}
