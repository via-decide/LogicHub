import type { NextConfig } from "next";
import path from "path";

const monorepoRoot = path.resolve(process.cwd(), '../..');

/**
 * The product engine lives in the engineering workspace, which uses the
 * workspace: protocol internally and so cannot be linked in as a file:
 * dependency from here. Aliasing its built output keeps one copy of the engine
 * with no duplication or publish step. The app's prebuild script installs the
 * engineering workspace from its lockfile and builds these artifacts, so this
 * also works from a clean checkout.
 */
const engineAlias = {
  '@logichub-engineering/product-graph': path.join(
    monorepoRoot, 'engineering/packages/product-graph/dist/index.js'),
  '@logichub-engineering/kit-matching': path.join(
    monorepoRoot, 'engineering/packages/kit-matching/dist/index.js'),
  '@logichub-engineering/shared': path.join(
    monorepoRoot, 'engineering/packages/shared/dist/index.js'),
};

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: monorepoRoot,
    resolveAlias: engineAlias,
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, ...engineAlias };
    return config;
  },
};

export default nextConfig;
