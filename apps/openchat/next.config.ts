import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

const nextConfig: NextConfig = {
  transpilePackages: ["@openchat/core"],
  output: "export",
  // Built-in image optimization is incompatible with `output: "export"`.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/images
  images: {
    unoptimized: true
  },
  turbopack: {
    // Absolute path required; resolves to repo root from apps/openchat
    root: monorepoRoot
  }
};

export default nextConfig;
