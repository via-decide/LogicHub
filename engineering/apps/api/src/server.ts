import Fastify, { type FastifyInstance } from 'fastify';
import { createAppContext, type AppContext, type AppContextOptions } from './app-context.js';
import { registerErrorHandler } from './error-handler.js';
import { registerRoutes } from './routes.js';

export interface BuildServerOptions {
  logger?: boolean;
  context?: AppContext;
  contextOptions?: AppContextOptions;
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  const ctx = options.context ?? createAppContext(options.contextOptions ?? { dbPath: ':memory:', artifactStoreRoot: '.artifacts' });

  registerErrorHandler(app);
  registerRoutes(app, ctx);

  return app;
}

export { createAppContext, type AppContext, type AppContextOptions } from './app-context.js';
