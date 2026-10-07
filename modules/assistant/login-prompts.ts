import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import { assistantSnapshot } from "@/modules/assistant/context"
import { gapLabelsFromSnapshot, promptsForLogin } from "@/modules/assistant/suggestions"

export async function loginPromptSuggestions(
  context: TenantContext,
  gaps?: string[],
  count = 3
) {
  const supabase = await createServerSupabase()
  const { data } = await supabase.auth.getUser()
  const seed = Date.parse(data.user?.last_sign_in_at ?? "") || 1
  const labels = gaps ?? gapLabelsFromSnapshot(await assistantSnapshot(context))
  return promptsForLogin(labels, seed, count)
}
