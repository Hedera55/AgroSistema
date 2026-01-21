import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-expect-error - Force webpack for next-pwa support
  experimental: {
    turbopack: false
  }
};

export default withPWA(nextConfig);
