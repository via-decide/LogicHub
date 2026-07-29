# Current LogicHub Architecture Audit

## Pages
- `index.html` is the primary builder workspace with landing content, auth controls, app forge, project map, generation, export, APK build, and publish flows.
- `pages/*.html`, `blueprints/index.html`, `onboarding.html`, `privacy.html`, and `terms.html` provide static marketing, onboarding, policy, and blueprint surfaces.
- `admin/index.html` calls admin API endpoints for operational views.
- `src/studio/index.html` contains an alternate studio/mobile builder surface.

## Components
- Browser components are vanilla HTML/CSS/JS in `index.html`, `components/*.js`, `js/*.js`, and `src/components/**/*.jsx`.
- Builder components are represented by canvas, graph, node editor, preview, deployment panel, and component library files under `src/components`.
- Navigation is preserved through `ecosystem-nav.js` and static page links.

## State management
- UI state is currently held in in-memory objects inside the browser app plus localStorage for usage counters, founder orders, onboarding, drafts, deployment status, and preferences.
- Runtime state is partially duplicated locally for project maps, generated code, APK status, publish status, and deployment traces.

## Authentication
- Existing auth includes Firebase client wiring in `index.html` and server-side helper endpoints under `api/_sovereignAuth.js`.
- Phase 1 integration delegates runtime authorization to DAXINI Identity via JWTs exposed to LogicHub as `daxini_jwt` and workspace context as `daxini_workspace_id`.

## Current AI integrations
- The previous primary builder path called Gemini directly from `index.html` and also called Zayvora planning/synthesis/verification endpoints.
- Server API files include historical Gemini, Ollama, and local service integrations. These are runtime concerns and must not be called by UI components.

## API calls
- Browser calls include access status, founder request, APK build, publish, analytics, and prior runtime/generation endpoints.
- The new rule is that frontend features call `window.LogicHubSDK` or typed modules under `sdk/`; SDK methods then target the DAXINI Gateway.

## Build system
- Package scripts use static Node helpers: `npm run build` executes `scripts/build-static.mjs`; `npm run dev` and `npm run preview` use `scripts/serve-static.mjs`.
- There is no frontend bundler requirement for the root app; browser SDK support is provided by `sdk/browser.js`.

## Export pipeline
- ZIP export remains client-side because it packages current UI artifacts and does not execute runtime reasoning.
- APK build and publish are now deployment/runtime requests delegated through DAXINI SDK endpoints.

## Templates
- Templates live in `templates/*.json` and `public/templates/*.json`, with `templates/index.json` as the index.
- Templates remain UI/project starter data; backend-managed persistence happens through project/workspace SDK APIs.

## Workflows
- Builder workflow: user adds blocks, configures prompts/files, generates via DAXINI runtime jobs, previews/exports locally, and deploys through DAXINI.
- Runtime workflow: LogicHub SDK sends authenticated workspace requests to DAXINI Gateway, receives job IDs/results/streams, and updates existing UI state.
