import { createServerSupabase } from "@/lib/supabase/server"
import type { Json } from "@/lib/database.types"

export async function recordAudit(
  action: string,
  targetType: string,
  targetId: string,
  metadata: Json = {}
) {
  const supabase = await createServerSupabase()
  await supabase.rpc("record_audit", {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_metadata: metadata,
  })
}
