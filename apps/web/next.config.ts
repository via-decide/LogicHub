import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: path.resolve(process.cwd(), '../..')
  }
};

export default nextConfig;
