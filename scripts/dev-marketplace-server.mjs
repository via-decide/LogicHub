// LogicHub/scripts/dev-marketplace-server.mjs
// Test-only server for tests/e2e/workspace.spec.ts — NOT for production or
// any real deployment. Combines static file serving (the same logic
// serve-static.mjs already uses) with the five real api/marketplace/*
// handlers, backed by the same in-memory fake db
// tests/marketplace-handlers.test.mjs uses via
// api/_pg.js's __setAdminDbForTesting.
//
// Why this exists at all: Vercel's real function routing (`vercel dev`)
// isn't available in this environment to verify against (no live
// DATABASE_URL, no confirmed Vercel CLI setup — see the F-4/postgres-install
// notes elsewhere in this branch), and playwright.config.ts's existing
// `site` project only runs serve-static.mjs, which is static-file-only and
// has no route for /api/*. Rather than write an e2e spec that could not
// actually be run and verified here, this stands up the real handler code
// (the actual functions Vercel would invoke, not a mock of them) over plain
// Node http, seeded with one open issue so the spec has something real to
// claim.
//
// Run: node scripts/dev-marketplace-server.mjs

import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// applyCors's DEFAULT_ORIGINS (api/_payments-config.js) only ever lists the
// real production/dev origins (logichub.app, localhost:3000/3001) -- in
// production this test server's concern doesn't exist at all, since the
// workspace page and the API share the same real origin there. Extending
// the allowlist here, before any handler runs, is what lets a real browser
// POST (claim/submit/run-ci/release) succeed against this test server
// rather than every write getting a 403 origin_not_allowed.
process.env.PAYMENTS_ALLOWED_ORIGINS = `http://127.0.0.1:${process.env.PORT || 5174}`;

import { __setAdminDbForTesting } from '../api/_pg.js';
import issuesHandler from '../api/marketplace/issues.js';
import claimHandler from '../api/marketplace/claim.js';
import submitHandler from '../api/marketplace/submit.js';
import runCiHandler from '../api/marketplace/run-ci.js';
import releaseHandler from '../api/marketplace/release.js';

const __dirname = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(__dirname, '..');
const port = Number(process.env.PORT || 5174);

// --- same generic fake store tests/marketplace-handlers.test.mjs uses ----
function fakeDb() {
  const collections = new Map();
  function docsFor(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }
  return {
    collection(name) {
      const docs = docsFor(name);
      return {
        doc(id) {
          return {
            async get() {
              const data = docs.get(id);
              return { exists: data !== undefined, data: () => (data ? { ...data } : undefined) };
            },
            async set(data, options = {}) {
              const base = options.merge ? docs.get(id) || {} : {};
              docs.set(id, { ...base, ...data });
            },
          };
        },
        async list({ where } = {}) {
          let entries = [...docs.entries()];
          if (where) entries = entries.filter(([, d]) => String(d[where.field]) === String(where.value));
          return entries.reverse().map(([id, data]) => ({ id, data: () => ({ ...data }) }));
        },
      };
    },
    _raw(name) { return docsFor(name); },
  };
}

let db = fakeDb();
__setAdminDbForTesting(db);

/**
 * Seeds (or re-seeds) ISSUE-E2E as OPEN. Test cases that claim/submit/run
 * CI against it leave real, mutated state behind (CLAIMED, MERGED, a new
 * pull request, etc.) in this same in-memory store, shared across the
 * whole Playwright run for speed — a fresh db per test would mean a fresh
 * server per test, which is slower and not how this server's reused
 * across a test file is meant to work. `/test/reset` (below) lets
 * tests/e2e/workspace.spec.ts's `beforeEach` put ISSUE-E2E back to a known
 * OPEN state without restarting the process.
 */
function seedFixtureIssue() {
  db._raw('marketplace_issues').set('ISSUE-E2E', {
    id: 'ISSUE-E2E',
    schemaVersion: '0.1.0',
    repositoryId: 'via-decide/LogicHub',
    title: 'Manufacture a cartridge shell (e2e fixture)',
    description: 'Seeded for tests/e2e/workspace.spec.ts.',
    rulesetYaml: 'rules:\n  - property: diameter_mm\n    target: 25.00\n    tolerance: 0.05\n',
    requiredNodeIds: ['manual-entry-01'],
    bounty: { state: 'UNAVAILABLE', reason: 'No component has been sourced.' },
    status: 'OPEN',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'e2e-fixture',
  });
}
seedFixtureIssue();

// --- static file serving, same logic as serve-static.mjs -----------------
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

function resolveStaticPath(urlPath) {
  const requestPath = decodeURIComponent(urlPath.split('?')[0]);
  const safePath = normalize(requestPath).replace(/^([.][.][/\\])+/, '');
  let candidate = join(root, safePath);
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  if (!extname(candidate)) {
    const htmlCandidate = `${candidate}.html`;
    if (existsSync(htmlCandidate) && statSync(htmlCandidate).isFile()) return htmlCandidate;
  }
  const indexCandidate = join(root, 'index.html');
  return existsSync(indexCandidate) ? indexCandidate : null;
}

// --- translate plain Node http req/res into the (req, res) shape every ---
// --- api/marketplace/*.js handler already expects (req.method,          ---
// --- req.headers, req.body, res.status().json()) — the same contract     ---
// --- Vercel's @vercel/node passes real handlers.                        ---
const ROUTES = {
  '/api/marketplace/issues': issuesHandler,
  '/api/marketplace/claim': claimHandler,
  '/api/marketplace/submit': submitHandler,
  '/api/marketplace/run-ci': runCiHandler,
  '/api/marketplace/release': releaseHandler,
};

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolvePromise({});
      try { resolvePromise(JSON.parse(raw)); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

http.createServer(async (req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  // Test-only reset hook -- not a real marketplace route, not something a
  // production deployment would ever expose. Rebuilds the fake db fresh
  // and re-seeds ISSUE-E2E as OPEN, so each spec that calls this in a
  // beforeEach starts from known state regardless of what an earlier test
  // in the same run mutated.
  if (pathname === '/test/reset' && req.method === 'POST') {
    db = fakeDb();
    __setAdminDbForTesting(db);
    seedFixtureIssue();
    res.statusCode = 200;
    res.end(JSON.stringify({ reset: true }));
    return;
  }

  const route = ROUTES[pathname];

  if (route) {
    let body = {};
    try {
      body = await readBody(req);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'invalid_json' }));
      return;
    }
    const fakeReq = { method: req.method, headers: req.headers, body };
    const fakeRes = {
      setHeader: (key, value) => res.setHeader(key, value),
      status(code) { res.statusCode = code; return fakeRes; },
      json(payload) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload)); return fakeRes; },
      send(payload) { res.end(payload); return fakeRes; },
      end() { res.end(); return fakeRes; },
    };
    await route(fakeReq, fakeRes);
    return;
  }

  const target = resolveStaticPath(req.url || '/');
  if (!target) { res.statusCode = 404; res.end('Not found'); return; }
  res.setHeader('Content-Type', mime[extname(target).toLowerCase()] || 'application/octet-stream');
  createReadStream(target).pipe(res);
}).listen(port, () => {
  console.log(`Marketplace e2e test server (real handlers, fake db) at http://localhost:${port}`);
});
