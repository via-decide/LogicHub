import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { createAppContext, type AppContext, type AppContextOptions } from './app-context.js';
import { registerErrorHandler } from './error-handler.js';
import { registerRoutes } from './routes.js';

export interface BuildServerOptions {
  logger?: boolean;
  context?: AppContext;
  contextOptions?: AppContextOptions;
  /** Origin(s) apps/web is served from, for the browser's own client-side fetches (Server Component fetches are same-machine and unaffected by CORS). Defaults to reflecting any origin -- this is a v0.1 internal tool, not a multi-tenant public API. */
  corsOrigin?: string | string[] | boolean;
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  const ctx = options.context ?? createAppContext(options.contextOptions ?? { dbPath: ':memory:', artifactStoreRoot: '.artifacts' });

  app.register(cors, { origin: options.corsOrigin ?? true });
  registerErrorHandler(app);
  registerRoutes(app, ctx);

  return app;
}

export { createAppContext, type AppContext, type AppContextOptions } from './app-context.js';
