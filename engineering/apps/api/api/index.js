// Vercel serverless entrypoint. Wraps the same Fastify instance apps/api/src/main.ts
// runs standalone -- no route or business-logic duplication here.
//
// Vercel's serverless filesystem is read-only except /tmp, and /tmp is wiped on
// every cold start -- so LOGICHUB_DB_PATH/LOGICHUB_ARTIFACT_STORE point at /tmp by
// default here (see vercel.json). Data does not persist across cold starts or
// redeploys. That tradeoff (fast demo deploy, no schema/infra migration yet) was
// an explicit choice -- see docs/operations/local-development.md for the real,
// persistent way to run this API.
import { buildServer } from '../dist/server.js';

let appPromise;

function getApp() {
  if (!appPromise) {
    const app = buildServer({
      logger: false,
      contextOptions: {
        dbPath: process.env.LOGICHUB_DB_PATH ?? '/tmp/logichub.db',
        artifactStoreRoot: process.env.LOGICHUB_ARTIFACT_STORE ?? '/tmp/artifacts',
      },
    });
    appPromise = app.ready().then(() => app);
  }
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
