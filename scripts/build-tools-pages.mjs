#!/usr/bin/env node

/**
 * Builds the interactive Next.js hardware tools as static HTML
 * and moves them to the root public/tools directory so they are
 * served from logichub.app/tools.
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { rmSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const rootDir = resolve(import.meta.dirname, '..');
const appsWebDir = resolve(rootDir, 'apps', 'web');
const publicToolsDir = resolve(rootDir, 'public', 'tools');
const webOutDir = resolve(appsWebDir, 'out');

console.log('Building hardware production tools from apps/web...');
try {
  // Temporarily remove edge runtime from root page.tsx to allow static export
  const pageTsxPath = resolve(appsWebDir, 'src/app/page.tsx');
  const originalPageTsx = readFileSync(pageTsxPath, 'utf8');
  if (originalPageTsx.includes('export const runtime = "edge";')) {
    writeFileSync(pageTsxPath, originalPageTsx.replace('export const runtime = "edge";', '// export const runtime = "edge";'));
  }

  try {
    // 1. Build the Next.js app using the build:tools script
    execSync('npm run build:tools', {
      stdio: 'inherit',
      cwd: appsWebDir,
    });
  } finally {
    // Always restore the original page.tsx
    writeFileSync(pageTsxPath, originalPageTsx);
  }

  // 2. Clean up any existing public/tools
  rmSync(publicToolsDir, { recursive: true, force: true });
  mkdirSync(publicToolsDir, { recursive: true });

  // 3. Move the statically exported 'out/tools' directory to 'public/tools'
  // Since we use trailingSlash: true, out/tools contains index.html
  cpSync(resolve(webOutDir, 'tools'), publicToolsDir, { recursive: true });
  
  // 4. Move out/_next to public/tools/_next so the assets resolve correctly
  cpSync(resolve(webOutDir, '_next'), resolve(publicToolsDir, '_next'), { recursive: true });

  console.log(`Successfully built tools to ${publicToolsDir}`);
} catch (err) {
  console.error('Failed to build hardware tools:', err.message);
  process.exit(1);
}
