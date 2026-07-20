# LogicHub API Spec

All frontend communication flows through `sdk/client.ts` or `sdk/browser.js` to `https://daxini.space/api` unless `DAXINI_API_URL` is configured.

## Auth
- `Authorization: Bearer <DAXINI_JWT>`
- `X-Workspace-Id: <workspace_id>`

## Resources
- `GET/POST/PATCH /workspace`
- `GET/POST/PATCH /projects`
- `GET/POST/PATCH /jobs`
- `GET/POST/PATCH /knowledge`
- `GET/POST/PATCH /deployment`
- `GET/POST/PATCH /settings`
- `GET/POST/PATCH /auth`

## Runtime endpoints
- `POST /runtime/jobs/generate-code` creates a DAXINI code generation job/result.
- `POST /runtime/zayvora/plan` creates architecture planning output.
- `POST /runtime/zayvora/synthesize` creates implementation output.
- `POST /runtime/zayvora/verify` creates hardening output.
- `GET ws(s)://.../jobs/{jobId}/stream` streams job lifecycle events.

## Deployment endpoints
- `POST /deployments` publishes a project bundle.
- `POST /deployments/apk` creates APK build artifacts.
