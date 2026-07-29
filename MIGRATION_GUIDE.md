# Migration Guide

1. Keep existing UI and navigation intact.
2. Move each direct `fetch()` in frontend files behind `LogicHubSDK.request()`.
3. Replace local runtime execution with DAXINI jobs.
4. Keep localStorage only for UI preferences, theme, navigation, recent projects, and drafts.
5. Store backend state in DAXINI-managed workspace resources.
6. Use WebSockets for job, deployment, knowledge, and workspace events.
