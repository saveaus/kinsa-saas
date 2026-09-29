import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/database.types"
import { publicEnv } from "@/lib/env"

export async function createServerSupabase() {
  const cookieStore = await cookies()
  const { url, publishableKey } = publicEnv()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component; proxy.ts refreshes the session.
        }
      },
    },
  })
}
