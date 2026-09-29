import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"
import { publicEnv, secretKey } from "@/lib/env"

export function createAdminSupabase() {
  const secret = secretKey()
  if (!secret) {
    throw new Error("Missing SUPABASE_SECRET_KEY")
  }

  const { url } = publicEnv()
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function hasAdminClient() {
  return Boolean(secretKey())
}
