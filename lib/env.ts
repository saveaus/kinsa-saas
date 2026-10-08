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
 * Use the request origin only when its host is the configured app host.
 * A forwarded host that does not match is ignored, so invite and billing
 * links stay on the app the deployment is configured to use.
 */
export function resolveAppUrl(requestOrigin?: string | null) {
  const configured = appUrl()
  const origin = requestOrigin?.replace(/\/$/, "") || null
  if (!origin) return configured

  try {
    const requestHost = new URL(origin).host
    const configuredHost = new URL(configured).host
    if (requestHost === configuredHost) return origin
    return configured
  } catch {
    return configured
  }
}
