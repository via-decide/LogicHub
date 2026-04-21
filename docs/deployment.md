# Logichub Deployment Guide

## Build and local commands

```bash
npm install
npm run build
npm run dev
npm run preview
```

- `npm run build` runs `deploy/health-check.js` in build mode.
- `npm run dev` serves the static app on `http://localhost:5173`.
- `npm run preview` serves the static app on `http://localhost:4173`.

## Hosting compatibility

### Vercel
- `vercel.json` includes a full SPA fallback route to `/`.
- Serverless endpoints under `/api/*` work when environment variables are configured.

### Cloudflare Pages
- Use static output with root `index.html`.
- Configure Functions only if `/api/*` routes are required; otherwise the static UI still loads.

### GitHub Pages
- Works as static hosting for UI and local ZIP export flow.
- `/api/*` endpoints are unavailable on pure Pages hosting; deploy APIs separately if needed.

## Required environment variables

Copy `.env.example` and fill values for:
- API integration keys (`GEMINI_API_KEY`, `RESEND_API_KEY`).
- GitHub publishing (`GITHUB_TOKEN`, repo identifiers).
- Execution runtime (`APK_SHELL_DIR` for APK pipeline).
- Firebase admin credentials for auth-aware serverless routes.

## Deployment health check

```bash
node deploy/health-check.js --mode=build
node deploy/health-check.js --mode=deployment
```

- Build mode validates UI shell, builder canvas markers, API handler presence, and static path safety.
- Deployment mode also probes live API reachability when `PUBLIC_SITE_URL` is configured.

## Recover failed Vercel deployments in bulk

1. Add deployment ids or URLs from the failed deployment list into `deploy/deployments-to-recover.txt` (one per line).
2. Preview commands without execution:

```bash
npm run recover:deployments
```

3. Execute redeploys:

```bash
npm run recover:deployments -- --run
```

4. Optional custom list file:

```bash
npm run recover:deployments -- --file=path/to/list.txt --run
```

## Troubleshooting

### Deployment shows blank UI
- Confirm `index.html` is served from site root.
- Check browser console for runtime exceptions.
- The app now displays a `Deployment error` overlay with startup failure details.

### Refresh causes 404 on nested routes
- Confirm SPA fallback config (`vercel.json` routes rule).
- For providers without rewrite support, route to `index.html` for all paths.

### API calls fail in static hosting
- Static hosts cannot execute Node serverless routes unless function runtime is enabled.
- Either deploy `/api` to Vercel/Workers or use a remote API base URL.

### Build fails due to missing env vars
- Compare deployment settings against `.env.example`.
- Do not commit real secrets; keep values in host environment settings.
