# LogicHub SDK Documentation

The SDK is the only approved frontend boundary to DAXINI.

## Browser usage
```html
<script src="./providers/daxini-provider.js"></script>
<script src="./sdk/browser.js"></script>
```

```js
const response = await window.LogicHubSDK.request('/projects', {
  method: 'POST',
  body: JSON.stringify({ name: 'Workspace App' })
});
```

## Typed usage
- `sdk/client.ts` contains `LogicHubClient`.
- `sdk/runtime.ts` contains runtime job helpers.
- Resource modules expose `list`, `get`, `create`, and `update` helpers.

## Streaming
Use `LogicHubSDK.streamJob(jobId, handler)` or `connectRuntimeStream` to receive job events over WebSocket.
