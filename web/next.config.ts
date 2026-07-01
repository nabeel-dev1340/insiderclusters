import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the monorepo root so Turbopack doesn't guess from multiple lockfiles.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // Transpile the shared workspace DB package (ships TypeScript source).
  transpilePackages: ["@insiderclusters/db"],
  // Keep `pg` (and its optional native bindings) as a runtime require rather
  // than bundling it into server chunks.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
