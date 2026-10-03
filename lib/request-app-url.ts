import { headers } from "next/headers"

import { resolveAppUrl } from "@/lib/env"

export async function requestAppUrl() {
  const headerStore = await headers()
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  const proto =
    headerStore.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https")
  return resolveAppUrl(host ? `${proto}://${host}` : null)
}
