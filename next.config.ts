import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Recordings are uploaded straight from the browser to Supabase Storage, so API bodies stay small.
};

export default nextConfig;
