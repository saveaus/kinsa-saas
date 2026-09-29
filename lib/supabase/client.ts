"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/database.types"
import { publicEnv } from "@/lib/env"

export function createBrowserSupabase() {
  const { url, publishableKey } = publicEnv()
  return createBrowserClient<Database>(url, publishableKey)
}
