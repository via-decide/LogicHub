# LogicHub Architecture

This document describes the architecture of the currently shipped LogicHub client in [`index.html`](https://github.com/via-decide/LogicHub/blob/main/index.html), not the earlier experimental map/feed prototype. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

## 1) Product model

LogicHub is a browser-first architecture canvas. Users create blocks representing files or layers of an app, connect those blocks to express dependencies, generate a PRD from the graph, and optionally synthesize code for each block with Gemini. Export to ZIP is fully client-side. APK generation is an optional server-assisted path. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html) [Source](https://github.com/via-decide/LogicHub/blob/main/api/build-apk.js)

## 2) Core data model

```js
LogicMap {
  id: string
  blocks: Block[]
  connections: Connection[]
}

Block {
  id: string
  type: 'ui' | 'api' | 'database' | 'auth' | 'util' | 'styles' | 'config'
  label: string
  filename: string
  prompt: string
  code: string
  x: number
  y: number
  status: 'PENDING' | 'GENERATING' | 'VERIFIED' | 'ERROR'
  dependsOn: string[]
  connectedTo: string[]
}

Connection {
  from: string
  to: string
}
```

The active client keeps all state in memory inside the `LogicMap` class and the `app` controller object. There is no persistent application database in the shipped UI. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

## 3) Frontend runtime

The frontend is intentionally simple:

- one HTML document with embedded CSS and JavaScript
- an SVG layer for connection paths
- an absolutely positioned block container for draggable nodes
- modal dialogs for node configuration, Forge controls, and PRD display
- footer actions for synth, export, APK, and wipe [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

## 4) Interaction flow

### Add blocks

Sidebar actions call `app.addBlock(type)`, which inserts a new `Block` into `LogicMap.blocks` with a default filename based on block type. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

### Connect blocks

Users drag from an output port to an input port. The app records a directional connection and updates both `dependsOn` and `connectedTo` arrays. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

### Configure blocks

Each block can be edited through the node modal, where the filename, prompt, and generated code are managed. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

### Generate PRD

`LogicMap.buildPRD()` transforms the current graph into a markdown PRD that lists each block, filename, dependencies, instructions, and any synthesized source output. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

## 5) Synthesis flow

The client-side synthesis path is BYOK. `app.synthesizeArchitecture()` iterates through blocks, builds a prompt using each block's instructions plus synthesized dependency context, calls the Gemini generate-content endpoint directly from the browser, and stores the returned code on the block. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

Implications:

- synthesis depends on a user-supplied Gemini API key
- generated code is not stored on a backend by default
- dependency ordering matters because downstream blocks may include upstream generated code as context [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

## 6) Export flow

### ZIP export

ZIP export is fully client-side. The app packages synthesized files plus `ARCHITECTURE_PRD.md` using JSZip and triggers a browser download. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

### APK export

APK export is an optional server-assisted path. The client sends a base64 ZIP payload to `/api/build-apk`, and the serverless function unpacks the web assets into a Capacitor/Gradle shell before returning an APK payload. This flow only works in environments where the API route and Android toolchain are available. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html) [Source](https://github.com/via-decide/LogicHub/blob/main/api/build-apk.js)

## 7) PWA layer

The shipped app includes a web manifest and a service worker. The service worker caches core assets, cleans up old caches, and provides same-origin offline fallback behavior for navigations and static assets. [Source](https://github.com/via-decide/LogicHub/blob/main/manifest.json) [Source](https://github.com/via-decide/LogicHub/blob/main/sw.js)

## 8) Optional backend endpoints

### `api/build-apk.js`

Accepts a posted ZIP payload, injects the generated web assets into an Android shell, runs Capacitor plus Gradle, and returns a base64 APK. Requires server configuration, `APK_SHELL_DIR`, and Android build tooling. [Source](https://github.com/via-decide/LogicHub/blob/main/api/build-apk.js)

### `api/publish/index.js`

Generates a single-file HTML app from PRD content using Gemini, commits the output into the `via-decide/daxini.space` repository, and returns a live URL. This path requires server-side credentials and is not part of the static GitHub Pages demo. [Source](https://github.com/via-decide/LogicHub/blob/main/api/publish/index.js)

## 9) Non-goals of the current codebase

The shipped UI does not currently include:

- feed browsing
- map forking
- localStorage-backed map persistence
- simulation engine execution
- comment threads [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)

Those concepts belonged to an older prototype and should not be treated as part of the current production architecture. [Source](https://github.com/via-decide/LogicHub/blob/main/index.html)
