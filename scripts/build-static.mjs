import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

const includePaths = [
  'index.html',
  'manifest.json',
  'sw.js',
  'vercel.json',
  '.env.example',
  'icons',
  'components',
  'js',
  'pages',
  'blueprints'
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const relativePath of includePaths) {
  const source = resolve(root, relativePath);
  if (!existsSync(source)) continue;
  const target = resolve(dist, relativePath);
  cpSync(source, target, { recursive: true });
}

console.log(`Static build prepared at ${dist}`);
