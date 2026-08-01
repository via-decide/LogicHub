import type { NextConfig } from "next";
import path from "path";

const monorepoRoot = path.resolve(process.cwd(), '../..');

/**
 * The product engine lives in the engineering workspace, which uses the
 * workspace: protocol internally and so cannot be linked in as a file:
 * dependency from here. Aliasing its built output keeps one copy of the engine
 * with no duplication and no publish step.
 */
const engineAliasWebpack = {
  '@logichub-engineering/product-graph': path.join(monorepoRoot, 'engineering/packages/product-graph/dist/index.js'),
  '@logichub-engineering/kit-matching': path.join(monorepoRoot, 'engineering/packages/kit-matching/dist/index.js'),
  '@logichub-engineering/shared': path.join(monorepoRoot, 'engineering/packages/shared/dist/index.js'),
};

const engineAliasTurbopack = {
  '@logichub-engineering/product-graph': '../../engineering/packages/product-graph/dist/index.js',
  '@logichub-engineering/kit-matching': '../../engineering/packages/kit-matching/dist/index.js',
  '@logichub-engineering/shared': '../../engineering/packages/shared/dist/index.js',
};

const isToolsBuild = process.env.BUILD_TOOLS === 'true';

const nextConfig: NextConfig = {
  output: isToolsBuild ? 'export' : 'standalone',
  assetPrefix: isToolsBuild ? '/tools' : undefined,
  trailingSlash: isToolsBuild ? true : undefined,
  // typescript: {
  //   ignoreBuildErrors: true,
  // },
  turbopack: {
    root: monorepoRoot,
    resolveAlias: engineAliasTurbopack,
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, ...engineAliasWebpack };
    return config;
  },
};

export default nextConfig;
