import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"

export async function ensureSelfWorker(context: TenantContext) {
  if (context.workerId) return context.workerId

  const supabase = await createServerSupabase()
  const email = context.email.trim().toLowerCase()
  const { data: existing, error } = await supabase
    .from("workers")
    .select("id, user_id")
    .eq("organisation_id", context.organisationId)
    .is("deleted_at", null)
    .ilike("email", email)
    .maybeSingle()
  if (error) throw new Error(error.message)

  if (existing) {
    if (!existing.user_id || existing.user_id === context.userId) {
      if (!existing.user_id) {
        const { error: linkError } = await supabase
          .from("workers")
          .update({ user_id: context.userId })
          .eq("id", existing.id)
          .eq("organisation_id", context.organisationId)
          .is("user_id", null)
        if (linkError) throw new Error(linkError.message)
        await recordAudit("worker.updated", "worker", existing.id, { linkedLogin: true })
      }
      return existing.id
    }
    throw new Error("A worker with your email is already linked to another login.")
  }

  const { firstName, lastName } = splitName(context.fullName, email)
  const { data, error: insertError } = await supabase
    .from("workers")
    .insert({
      organisation_id: context.organisationId,
      user_id: context.userId,
      first_name: firstName,
      last_name: lastName,
      email,
      staff_roles: ["office"],
    })
    .select("id")
    .single()
  if (insertError) throw new Error(insertError.message)

  await recordAudit("worker.created", "worker", data.id, { email, self: true })
  return data.id
}

function splitName(fullName: string | null, email: string) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
  }
  if (parts.length === 1) return { firstName: parts[0], lastName: "Account" }
  const local = email.split("@")[0]?.trim() || "Member"
  return { firstName: local, lastName: "Account" }
}
