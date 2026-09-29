import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  async redirects() {
    return [{ source: "/audit", destination: "/activity", permanent: false }]
  },
}

export default nextConfig
