import { createServerSupabase } from "@/lib/supabase/server"
import { hashToken } from "@/modules/identity/token"

export async function peekInvite(token: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.rpc("peek_invite", {
    p_token_hash: hashToken(token),
  })
  if (error) {
    throw new Error(error.message)
  }
  return data?.[0] ?? null
}
