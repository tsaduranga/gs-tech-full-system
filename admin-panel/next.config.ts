import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const appNodeModules = path.join(appDir, "node_modules");

const allowedDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? ["72.60.102.85"];

const nextConfig: NextConfig = {
  // Do not set turbopack.root here — it breaks @import "tailwindcss" resolution.
  allowedDevOrigins,
  webpack: (config) => {
    config.resolve ??= {};
    const existing = config.resolve.modules;
    const modules = Array.isArray(existing)
      ? existing
      : existing
        ? [existing]
        : [];
    config.resolve.modules = [appNodeModules, ...modules, "node_modules"];
    return config;
  },
};

export default nextConfig;
