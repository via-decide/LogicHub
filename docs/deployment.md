# Deployment Guide

## Build Commands

```bash
npm install
npm run build
npm run preview
```

- `npm run build` creates a static `dist/` directory.
- `npm run dev` serves the repository directly (`http://localhost:5173`).
- `npm run preview` serves the built `dist/` output (`http://localhost:4173`).

## Hosting Compatibility

### Vercel
- Uses `vercel.json` SPA fallback so refresh does not 404.
- `/api/*` serverless routes work when deployed as a Vercel project.

### Cloudflare Pages
- Deploy the `dist/` folder.
- Configure SPA fallback to `index.html` for client-side routes.
- `/api/*` endpoints are optional unless you also deploy worker/functions.

### GitHub Pages
- Deploy static files only (`index.html`, assets, `sw.js`, etc.).
- API-backed actions (publish/APK/founder checks) are optional and will show in-app errors if missing.

## Environment Variables

Copy `.env.example` and set the values required for your target platform:

- API and engine:
  - `SITE_URL`
  - `API_BASE_URL`
  - `EXECUTION_ENGINE`
- GitHub integration:
  - `GITHUB_TOKEN`
  - `GITHUB_OWNER`
  - `GITHUB_REPO`
  - `GITHUB_BRANCH`
- Server functions:
  - `GEMINI_API_KEY`
  - `FIREBASE_*`
  - `RESEND_*`

## Deployment Health Check

Run:

```bash
node deploy/health-check.js
```

Optional vars:

```bash
DEPLOY_BASE_URL=https://your-site.example
API_BASE_URL=https://your-site.example/api
```

Checks performed:
1. UI root responds successfully.
2. Builder canvas marker (`#canvas`) exists in loaded HTML.
3. Optional API endpoints are reachable or skipped with a warning on static hosts.

## Troubleshooting

### Blank page or script crash
- Open browser console.
- Ensure deployment served latest `index.html`.
- Confirm no syntax errors in inline scripts.

### 404 on refresh
- Verify SPA fallback routing is enabled (`vercel.json` routes, or equivalent host setting).

### API actions fail on static hosts
- This is expected if `/api/*` is not deployed.
- Core builder/edit/export UI should still function.

### Service worker stale assets
- Hard refresh / clear site data.
- Ensure `sw.js` is deployed and not aggressively cached.
