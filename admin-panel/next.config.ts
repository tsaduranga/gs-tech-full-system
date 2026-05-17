import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const allowedDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? ["72.60.102.85"];

const nextConfig: NextConfig = {
  turbopack: {
    root: appDir,
  },
  allowedDevOrigins,
};

export default nextConfig;
