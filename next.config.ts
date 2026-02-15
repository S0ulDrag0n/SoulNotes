import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  reactCompiler: true,
  env: {
    isTauri: process.env.TAURI === 'true' ? 'true' : 'false',
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
