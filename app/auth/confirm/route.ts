import { redirect } from "next/navigation"

import { isAuthEmailType, safeNext } from "@/modules/identity/confirm-link"
import { createServerSupabase } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type")
  const next = safeNext(url.searchParams.get("next"))
  if (!tokenHash || !isAuthEmailType(type)) {
    redirect("/login?error=confirm")
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })
  if (error) redirect("/login?error=confirm")
  redirect(next)
}
