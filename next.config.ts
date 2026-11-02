import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/policy-templates/[key]": ["./modules/policies/templates/files/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
  async redirects() {
    return [
      { source: "/audit", destination: "/activity", permanent: false },
      {
        source: "/account",
        destination: "/settings/password",
        permanent: false,
      },
      {
        source: "/reminders",
        destination: "/workflows",
        permanent: false,
      },
      {
        source: "/settings/reminders",
        destination: "/workflows",
        permanent: false,
      },
      {
        source: "/settings/emails",
        destination: "/workflows",
        permanent: false,
      },
      { source: "/courses", destination: "/workers", permanent: false },
      { source: "/courses/:path*", destination: "/workers", permanent: false },
      { source: "/me/courses", destination: "/me", permanent: false },
      { source: "/me/courses/:path*", destination: "/me", permanent: false },
      { source: "/settings/courses", destination: "/settings", permanent: false },
      { source: "/certificates/:path*", destination: "/workers", permanent: false },
      {
        source: "/settings/logs",
        destination: "/settings/general",
        permanent: false,
      },
      {
        source: "/settings/roles",
        destination: "/settings/teams",
        permanent: false,
      },
      {
        source: "/incidents",
        destination: "/logs/incidents",
        permanent: false,
      },
      {
        source: "/complaints",
        destination: "/logs/complaints",
        permanent: false,
      },
      { source: "/risks", destination: "/logs/risks", permanent: false },
      {
        source: "/restrictive-practices",
        destination: "/logs/restrictive-practices",
        permanent: false,
      },
      {
        source: "/support-plan-checks",
        destination: "/participants",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
