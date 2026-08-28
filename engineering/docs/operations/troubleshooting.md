# Troubleshooting

Real problems hit while building and e2e-testing Phases 5–8, and how they were actually diagnosed and fixed — kept here because each one reproduces identically for anyone else running this stack locally.

## Playwright's `webServer` never becomes "ready" (times out at ~120s)

**Symptom:** `npx playwright test` hangs, then fails with a webServer timeout, even though the process it started is actually up and answering requests.

**Cause:** Playwright's `webServer.url` readiness probe only accepts an HTTP response in the 2xx/3xx range. `engineering/apps/api` has no route registered at `/` — hitting it correctly returns `404`, which Playwright reads as "not ready" forever, not as "server is up, that endpoint just 404s."

**Fix:** Point `url` at a route the server actually serves with 200, e.g. `/projects` (see the `engineering` webServer entry in `playwright.config.ts`). Don't add a dummy `/` route just to satisfy the probe.

## `apps/web` builds and starts, but every page is static HTML with zero interactivity

**Symptom:** The server responds, the initial HTML renders, but clicking anything does nothing; the browser console shows failed requests for `/_next/static/...` chunks (500 or 404).

**Cause:** `apps/web/next.config.ts` sets `output: 'standalone'` (Docker/Vercel-style deployment). Next.js itself warns that **`next start` does not work with `output: 'standalone'`** — the standalone server (`'.next/standalone/.../server.js'`) expects static assets and `public/` to be copied alongside it, which a plain `next build && next start` never does. Running `next start` against a standalone build serves the shell page fine and then 500s on every JS chunk, so nothing ever hydrates.

**Fix:** Build, copy `.next/static` and `public/` into the standalone output directory, then run the real `server.js` directly — not `next start`:

```sh
cd apps/web
pnpm build
cp -r .next/static .next/standalone/apps/web/.next/static
cp -r public .next/standalone/apps/web/public
PORT=3001 HOSTNAME=127.0.0.1 node .next/standalone/apps/web/server.js
```

The standalone `server.js` takes `PORT`/`HOSTNAME` environment variables, not a `next start -p` flag. This also fixed the repo's pre-existing `product` Playwright project, which had never actually passed before this was corrected.

## Browser fetches go to `localhost:3000` regardless of the configured API URL

**Symptom:** Server-rendered pages show real data, but any client-side action (submit review, merge, recalculate) fails with a connection error to the wrong port.

**Cause:** Next.js only inlines environment variables prefixed `NEXT_PUBLIC_` into the client bundle, and only at **build time**. Setting `LOGICHUB_API_URL` (server-only) is enough for Server Components' fetches but invisible to browser-side code, which falls back to whatever default is hardcoded.

**Fix:** Set `NEXT_PUBLIC_LOGICHUB_API_URL` alongside `LOGICHUB_API_URL`, and make sure it's present in the environment **before** `next build` runs (setting it only before `next start`/`server.js` has no effect — the value is already baked into the bundle by then).

## `POST` requests with no body return `400 Bad Request` from the API

**Symptom:** Bodyless actions like `recalculate` or `close` fail with a generic 400 from Fastify, before request validation even runs.

**Cause:** Fastify's built-in JSON body parser rejects a request that carries `content-type: application/json` but an empty body. A client helper that unconditionally sets that header — even when it isn't sending a body — trips this.

**Fix:** Only set `content-type: application/json` when an actual body is being sent (see `apps/web/src/lib/logichub-api.ts`'s `request()`).

## Browser fetches to the API are blocked with no visible error (CORS)

**Symptom:** Client-side calls from `apps/web` to `apps/api` fail silently; the browser network tab shows the request but the response is blocked, with a CORS error only visible in the console.

**Cause:** `apps/web` and `apps/api` run on different origins (different ports). Server-side (Server Component) fetches are same-machine and unaffected by CORS; only client-side (browser) fetches are. `apps/api` had no CORS headers.

**Fix:** Register `@fastify/cors` on the Fastify instance (`origin: true` is sufficient for local/dev use — there is no cross-origin credential or cookie flow here to scope further).

## Playwright locator throws "strict mode violation: resolved to N elements"

**Symptom:** A `getByText(...)` locator that looks unambiguous fails because it matches more than one element on the page.

**Cause:** Text that appears in more than one place with different semantic roles — e.g. `getByText('Approved')` matching both a status badge in the page header and an identical string inside a review-history list item; `getByText('schematic')` matching both a tab button labeled "Schematic" and an unrelated lowercase domain-count span, because Playwright's default text match is substring/case-insensitive.

**Fix:** Scope the locator — `.first()` when either match is an acceptable target, or `{ exact: true }` plus a more specific ancestor scope when it isn't.

## Ancestor sandbox quirks unrelated to the app itself

Two environment-specific quirks encountered while iterating on the above, noted so they aren't mistaken for application bugs: `pkill <name>` doesn't find a running Next.js dev/standalone server because Next sets a custom process title (`next-server`) different from its `argv[0]` — use `fuser -k <port>/tcp` instead. And backgrounded shell commands in this sandbox can occasionally report a spurious non-zero exit without indicating an actual failure — a `nohup ... &` plus a polling loop that checks the actual condition (port listening, process alive) is more reliable than trusting the backgrounding command's own exit code.
