export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key")
  }

  return { url, publishableKey }
}

export function secretKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null
}

/** Canonical public app origin for emails and auth redirects. */
export function appUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (configured) return configured

  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`
  }

  return "http://localhost:3000"
}

/**
 * Prefer the request host (so production signups never emit localhost links),
 * but never trust localhost/private hosts when a public app URL is configured.
 */
export function resolveAppUrl(requestOrigin?: string | null) {
  const configured = appUrl()
  const origin = requestOrigin?.replace(/\/$/, "") || null
  if (!origin) return configured

  try {
    const host = new URL(origin).hostname
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host.endsWith(".local") || host === "0.0.0.0"
    if (isLocal && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
      return configured
    }
    return origin
  } catch {
    return configured
  }
}
