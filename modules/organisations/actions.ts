"use server"

import { revalidatePath } from "next/cache"

import { isValidAbn, parseAbn } from "@/lib/abn"
import { parseRegistrationGroups } from "@/lib/ndis-registration-groups"
import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"

export type OrganisationActionState = { error?: string; message?: string; href?: string }

const LOGO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024

function refreshWorkspace() {
  revalidatePath("/", "layout")
  revalidatePath("/settings/general")
  revalidatePath("/settings/registration-groups")
}

export async function uploadOrganisationLogoAction(
  _prev: OrganisationActionState,
  formData: FormData
): Promise<OrganisationActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

  const file = formData.get("logo")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." }
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "Logo must be under 2 MB." }
  }
  const extension = LOGO_EXTENSIONS[file.type]
  if (!extension) {
    return { error: "Use a PNG, JPG, GIF, or WebP image." }
  }

  const supabase = await createServerSupabase()
  const path = `${context.organisationId}/logo.${extension}`
  const { data: current } = await supabase
    .from("organisations")
    .select("logo_path")
    .eq("id", context.organisationId)
    .maybeSingle()

  if (current?.logo_path && current.logo_path !== path) {
    await supabase.storage.from("organisation-logos").remove([current.logo_path])
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage.from("organisation-logos").upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase
    .from("organisations")
    .update({ logo_path: path })
    .eq("id", context.organisationId)
  if (error) {
    await supabase.storage.from("organisation-logos").remove([path])
    return { error: error.message }
  }

  await recordAudit("organisation.logo_updated", "organisation", context.organisationId, { path })
  refreshWorkspace()
  return { message: "Logo updated." }
}

export async function removeOrganisationLogoAction(
  _prev: OrganisationActionState,
  _formData: FormData
): Promise<OrganisationActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

  const supabase = await createServerSupabase()
  const { data: current } = await supabase
    .from("organisations")
    .select("logo_path")
    .eq("id", context.organisationId)
    .maybeSingle()

  if (current?.logo_path) {
    const { error: removeError } = await supabase.storage.from("organisation-logos").remove([current.logo_path])
    if (removeError) return { error: removeError.message }
  }

  const { error } = await supabase
    .from("organisations")
    .update({ logo_path: null })
    .eq("id", context.organisationId)
  if (error) return { error: error.message }

  await recordAudit("organisation.logo_removed", "organisation", context.organisationId, {})
  refreshWorkspace()
  return { message: "Logo removed." }
}

export async function updateOrganisationIdentityAction(
  _prev: OrganisationActionState,
  formData: FormData
): Promise<OrganisationActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

  const name = String(formData.get("name") ?? "").trim()
  const abnRaw = String(formData.get("abn") ?? "").trim()
  const registration = String(formData.get("registration_number") ?? "").trim()

  if (!name || name.length > 200) {
    return { error: "Enter the business name as it should appear on certificates." }
  }

  let abn: string | null = null
  if (abnRaw) {
    const parsed = parseAbn(abnRaw)
    if (!parsed || !isValidAbn(parsed)) {
      return { error: "Enter a valid 11-digit Australian Business Number." }
    }
    abn = parsed
  }

  if (registration && (registration.length < 4 || registration.length > 40)) {
    return { error: "Enter the NDIS registration number, or leave it blank." }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("organisations")
    .update({
      name,
      abn,
      registration_number: registration || null,
    })
    .eq("id", context.organisationId)
  if (error) return { error: error.message }

  await recordAudit("organisation.identity_updated", "organisation", context.organisationId, {
    abn: Boolean(abn),
    registration: Boolean(registration),
  })
  refreshWorkspace()
  return { message: "Business details saved. They will appear on training certificates." }
}

export async function updateRegistrationGroupsAction(
  _prev: OrganisationActionState,
  formData: FormData
): Promise<OrganisationActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

  const registrationGroups = parseRegistrationGroups(formData)
  if (registrationGroups.length === 0) {
    return { error: "Select at least one NDIS registration group." }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("organisations")
    .update({ registration_groups: registrationGroups })
    .eq("id", context.organisationId)
  if (error) return { error: error.message }

  await recordAudit("organisation.registration_groups_updated", "organisation", context.organisationId, {
    registrationGroups: registrationGroups.length,
  })
  refreshWorkspace()
  return {
    message: "Registration groups saved.",
    href: "/settings/general",
  }
}
