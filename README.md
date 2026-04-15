# LogicHub ⚡

**Visual architecture builder for AI-assisted app scaffolding.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Built with Vanilla JS](https://img.shields.io/badge/Tech-Vanilla%20JS-f1e05a.svg)](https://github.com/via-decide/LogicHub)
[![Single File App](https://img.shields.io/badge/App-Single%20HTML-111827.svg)](https://github.com/via-decide/LogicHub/blob/main/index.html)

LogicHub is a browser-first node canvas for mapping an application architecture, generating a structured PRD, synthesizing file-by-file code with your own Gemini API key, and exporting the result as a ZIP. The current product is centered on the single-file UI in [`index.html`](https://github.com/via-decide/LogicHub/blob/main/index.html). [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

🌐 **Live demo:** https://via-decide.github.io/LogicHub  
📦 **Repo:** https://github.com/via-decide/LogicHub

---

## What LogicHub does

- Build an architecture visually with draggable nodes such as `UI`, `API`, `DB`, `AUTH`, `UTIL`, `CSS`, and `CFG`.
- Connect nodes to express file dependencies.
- Generate a PRD locally from the graph.
- Use your own Gemini API key to synthesize code block-by-block in the browser.
- Export synthesized output as a ZIP.
- Optionally request an APK build when deployed with the serverless API layer. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html) [Source](https://github.com/via-decide/LogicHub/blob/main/api/build-apk.js)

## Current repo structure

- [`index.html`](https://github.com/via-decide/LogicHub/blob/main/index.html): canonical app UI and client logic.
- [`manifest.json`](https://github.com/via-decide/LogicHub/blob/main/manifest.json): PWA metadata.
- [`sw.js`](https://github.com/via-decide/LogicHub/blob/main/sw.js): service worker for install/offline support.
- [`api/build-apk.js`](https://github.com/via-decide/LogicHub/blob/main/api/build-apk.js): optional serverless APK build endpoint.
- [`api/publish.js`](https://github.com/via-decide/LogicHub/blob/main/api/publish.js): optional serverless publish flow for generated apps. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html) [Source](https://github.com/via-decide/LogicHub/blob/main/manifest.json) [Source](https://github.com/via-decide/LogicHub/blob/main/sw.js) [Source](https://github.com/via-decide/LogicHub/blob/main/api/build-apk.js) [Source](https://github.com/via-decide/LogicHub/blob/main/api/publish.js)

## Local development

LogicHub does not require a bundler. For local development, serve the repository as static files so the manifest and service worker work correctly.

```bash
git clone https://github.com/via-decide/LogicHub.git
cd LogicHub
python -m http.server 8000
```

Then open `http://localhost:8000`. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html) [Source](https://github.com/via-decide/LogicHub/blob/main/manifest.json)

## Usage flow

1. Add nodes from the sidebar.
2. Drag nodes to arrange the architecture.
3. Drag from a node's right port to another node's left port to create dependencies.
4. Open node config to set filename and generation instructions.
5. Click **PRD** to inspect the generated architecture brief.
6. Provide a Gemini API key and click **Synth** to generate code.
7. Click **Export** to download a ZIP.
8. Click **APK** only when running behind a deployment that exposes `/api/build-apk`. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html) [Source](https://github.com/via-decide/LogicHub/blob/main/api/build-apk.js)

## Deployment notes

The GitHub Pages demo is a static deployment. Features that depend on `/api/*` routes require a server environment such as Vercel with the corresponding serverless functions configured. In particular:

- `Synth` works directly in the browser using the user's Gemini API key.
- `Export` works locally in the browser.
- `APK` requires `/api/build-apk` plus server-side Android shell tooling.
- `publish.js` requires server-side environment variables and GitHub access. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html) [Source](https://github.com/via-decide/LogicHub/blob/main/api/build-apk.js) [Source](https://github.com/via-decide/LogicHub/blob/main/api/publish.js)

## Cleanup notes for maintainers

This repository previously contained an older map/feed prototype that no longer matched the shipped UI. The cleanup in this branch keeps the current single-file app as the source of truth and aligns documentation with the code that is actually loaded in production. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

## License

Released under the Apache License 2.0. See [`LICENSE`](https://github.com/via-decide/LogicHub/blob/main/LICENSE).
