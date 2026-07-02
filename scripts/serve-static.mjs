import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(__dirname, '..');
const useDist = process.argv.includes('--dist');
const baseDir = useDist ? resolve(root, 'dist') : root;
const port = Number(process.env.PORT || (useDist ? 4173 : 5173));

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function sendFile(pathname, res) {
  const ext = extname(pathname).toLowerCase();
  res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
  createReadStream(pathname).pipe(res);
}

function resolvePath(urlPath) {
  const requestPath = decodeURIComponent(urlPath.split('?')[0]);
  const safePath = normalize(requestPath).replace(/^([.][.][/\\])+/, '');
  let candidate = join(baseDir, safePath);
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const directoryIndex = join(candidate, 'index.html');
    if (existsSync(directoryIndex)) return directoryIndex;
  }
  if (!extname(candidate)) {
    const htmlCandidate = `${candidate}.html`;
    if (existsSync(htmlCandidate) && statSync(htmlCandidate).isFile()) return htmlCandidate;
  }
  const spaFallback = join(baseDir, 'index.html');
  return existsSync(spaFallback) ? spaFallback : null;
}

http.createServer((req, res) => {
  const target = resolvePath(req.url || '/');
  if (!target) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  sendFile(target, res);
}).listen(port, () => {
  console.log(`Serving ${useDist ? 'dist' : 'repo'} at http://localhost:${port}`);
});
