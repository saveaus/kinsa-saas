import { createServerSupabase } from "@/lib/supabase/server"

export async function assertRateLimit(key: string, max: number, windowSeconds: number) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Too many attempts. Please wait and try again.")
  }
}
