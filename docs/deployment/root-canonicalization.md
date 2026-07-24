# Root canonicalization

`site/index.html` is the canonical source for the public LogicHub landing page. Run `pnpm site:build` to inject the current Git commit and copy the generated output to both `index.html` and `public/index.html` for hosts that publish either location.

The preserved AI App Builder is served from `/builder/` with its own manifest and service worker scope. The root page does not register a service worker, does not load Firebase, and includes a one-time migration script that unregisters the legacy root `sw.js` worker and deletes known legacy caches.

Use `pnpm site:verify` before deployment. Use `pnpm site:verify-live --url https://logichub.app/ --expected-commit "$(git rev-parse HEAD)"` after deployment; failed network access or mismatched build IDs must not be reported as a pass.
