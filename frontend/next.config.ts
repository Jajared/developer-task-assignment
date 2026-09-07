import path from "node:path";

import type { NextConfig } from "next";

const workspaceRoot = path.join(import.meta.dirname, "..");

const nextConfig: NextConfig = {
  // The lockfile lives at the repo root, so name it explicitly rather than
  // letting Turbopack infer the workspace root.
  turbopack: { root: workspaceRoot },
  // Self-contained server for the Docker image (frontend/Dockerfile). Tracing
  // from the workspace root keeps hoisted node_modules in the output.
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
