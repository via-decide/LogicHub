# Live verification

Attempted from this environment on 2026-07-24.

- `curl -sSIL https://logichub.app/` failed with `CONNECT tunnel failed, response 403`.
- `pnpm site:verify-live --url https://logichub.app/ --expected-commit "$(git rev-parse HEAD)"` wrote `artifacts/deployment/root-response-matrix.json` and failed because all fetches returned `fetch failed` from the environment.

This is not recorded as a production pass; rerun after deployment from an environment with outbound access.
