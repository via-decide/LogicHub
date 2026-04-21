#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

console.log('\n📋 Finalizing build...');

const requiredEntries = ['index.html', 'api'];
let allPresent = true;

for (const entry of requiredEntries) {
  const entryPath = path.join(PUBLIC_DIR, entry);
  const exists = fs.existsSync(entryPath);
  console.log(`${exists ? '✅' : '❌'} ${entry}`);
  if (!exists) allPresent = false;
}

if (!allPresent) {
  console.error('\n❌ Build finalization failed: missing required files');
  process.exit(1);
}

const fileCount = countFiles(PUBLIC_DIR);
const size = directorySize(PUBLIC_DIR);

console.log(`\n📦 Total files in public/: ${fileCount}`);
console.log(`📊 Build size: ${formatSize(size)}`);
console.log('\n✅ Build finalized successfully');

function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir)) {
    const entryPath = path.join(dir, entry);
    const stats = fs.statSync(entryPath);
    if (stats.isDirectory()) {
      count += countFiles(entryPath);
    } else {
      count += 1;
    }
  }
  return count;
}

function directorySize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir)) {
    const entryPath = path.join(dir, entry);
    const stats = fs.statSync(entryPath);
    if (stats.isDirectory()) {
      total += directorySize(entryPath);
    } else {
      total += stats.size;
    }
  }
  return total;
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;

  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }

  return `${value.toFixed(2)} ${units[idx]}`;
}
