import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  env: {
    isTauri: process.env.TAURI === 'true' ? 'true' : 'false',
  },
};

export default nextConfig;
