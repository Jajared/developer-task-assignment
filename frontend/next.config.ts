import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The lockfile lives at the repo root, so name it explicitly rather than
  // letting Turbopack infer the workspace root.
  turbopack: { root: path.join(import.meta.dirname, "..") },
};

export default nextConfig;
