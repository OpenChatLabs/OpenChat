import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const nextConfig: NextConfig = {
  transpilePackages: ["@openchat/core"],
  // 聊天页使用 Route Handler 收发邮件；`output: "export"` 不支持 API。
  images: {
    unoptimized: true,
  },
  turbopack: {
    // Absolute path required; resolves to repo root from apps/openchat
    root: monorepoRoot,
  },
};

export default nextConfig;
