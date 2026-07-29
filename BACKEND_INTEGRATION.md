# Backend Integration

LogicHub is a DAXINI runtime client. It owns builder interaction, visualization, local exports, and collaboration UI. DAXINI owns identity, workspace context, runtime execution, orchestration, model access, jobs, deployments, knowledge indexing, billing, and permissions.

## Integration boundary
- Allowed: `LogicHubSDK` calls to DAXINI Gateway.
- Forbidden: direct browser calls to model providers or local reasoning services.

## Error handling
Normalize network failure, token expiry, runtime offline, missing workspace, permission errors, and streaming failure before displaying existing UI notifications.
