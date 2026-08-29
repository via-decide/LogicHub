import { buildServer } from './server.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildServer({
  logger: true,
  contextOptions: {
    dbPath: process.env.LOGICHUB_DB_PATH ?? './logichub.db',
    artifactStoreRoot: process.env.LOGICHUB_ARTIFACT_STORE ?? './artifacts',
  },
});

app
  .listen({ port, host })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
