# WebSocket Protocol

Connect to `/jobs/{jobId}/stream` with `token` and `workspaceId` query parameters.

## Event types
- `job.queued`
- `job.running`
- `job.evaluating`
- `job.delta`
- `job.completed`
- `job.cancelled`
- `job.failed`
- `deployment.completed`
- `knowledge.indexed`
- `workspace.updated`
- `runtime.offline`

Payloads include `id`, `workspaceId`, `status`, `timestamp`, and optional `data`.
