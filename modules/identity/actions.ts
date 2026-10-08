"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { isValidAbn, parseAbn } from "@/lib/abn"
import { parseRegistrationGroups } from "@/lib/ndis-registration-groups"
import { assertRateLimit } from "@/lib/rate-limit"
import { createServerSupabase } from "@/lib/supabase/server"
import { requireAuthUser } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { sendPasswordReset, sendSignupConfirmation } from "@/modules/identity/confirm-link"
import { hashToken } from "@/modules/identity/token"
import { peekInvite } from "@/modules/identity/queries"

export type AuthActionState = { error?: string; message?: string }

async function clientIp() {
  const headerStore = await headers()
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  await assertRateLimit(`login:${email}:${await clientIp()}`, 8, 300)

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message }
  }

  redirect("/dashboard")
}

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") ?? "")
  const fullName = personName(formData)

  if (!fullName) {
    return { error: "Enter your name." }
  }

  if (!email || !password || password.length < 8) {
    return {
      error: "Use a valid email and a password of at least 8 characters.",
    }
  }

  await assertRateLimit(`signup:${email}:${await clientIp()}`, 5, 600)

  return sendSignupConfirmation({
    email,
    password,
    fullName,
    next: "/onboarding",
  })
}

export async function signOutAction() {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  if (!email) return { error: "Email is required." }

  await assertRateLimit(`reset:${email}:${await clientIp()}`, 5, 600)

  return sendPasswordReset(email)
}

export async function updatePasswordAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  await requireAuthUser()
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")
  if (password.length < 8)
    return { error: "Use a password of at least 8 characters." }
  if (password !== confirm) return { error: "Passwords do not match." }

  await assertRateLimit(`password:${await clientIp()}`, 8, 600)

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  return { message: "Password updated. You can sign in with it now." }
}

const LOGO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024

function personName(formData: FormData) {
  const first = String(formData.get("first_name") ?? "").trim()
  const last = String(formData.get("last_name") ?? "").trim()
  const combined = [first, last].filter(Boolean).join(" ")
  return combined || String(formData.get("full_name") ?? "").trim()
}

export async function createOrganisationAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  await requireAuthUser()
  const name = String(formData.get("name") ?? "").trim()
  if (!name || name.length > 200) {
    return { error: "Enter the organisation name." }
  }

  const registrationGroups = parseRegistrationGroups(formData)
  if (registrationGroups.length === 0) {
    return { error: "Select at least one NDIS registration group." }
  }

  const abnRaw = String(formData.get("abn") ?? "").trim()
  let abn: string | null = null
  if (abnRaw) {
    const parsed = parseAbn(abnRaw)
    if (!parsed || !isValidAbn(parsed)) {
      return { error: "Enter a valid 11-digit Australian Business Number." }
    }
    abn = parsed
  }

  const registration = String(formData.get("registration_number") ?? "").trim()
  if (registration && (registration.length < 4 || registration.length > 40)) {
    return { error: "Enter the NDIS registration number, or leave it blank." }
  }

  const logo = formData.get("logo")
  let logoFile: File | null = null
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) return { error: "Logo must be under 2 MB." }
    if (!LOGO_EXTENSIONS[logo.type]) {
      return { error: "Use a PNG, JPG, GIF, or WebP image." }
    }
    logoFile = logo
  }

  const supabase = await createServerSupabase()
  const { data: existing, error: membershipError } = await supabase
    .from("memberships")
    .select("organisation_id")
    .limit(1)
    .maybeSingle()
  if (membershipError) return { error: membershipError.message }

  let organisationId = existing?.organisation_id ?? null
  if (!organisationId) {
    const { data, error } = await supabase.rpc("create_organisation", {
      org_name: name,
      p_registration_groups: registrationGroups,
    })
    if (error || !data) {
      return { error: error?.message ?? "Could not create the organisation." }
    }
    organisationId = data
  }

  const { error: updateError } = await supabase
    .from("organisations")
    .update({
      name,
      abn,
      registration_number: registration || null,
      registration_groups: registrationGroups,
    })
    .eq("id", organisationId)
  if (updateError) return { error: updateError.message }

  if (logoFile) {
    const extension = LOGO_EXTENSIONS[logoFile.type]
    const path = `${organisationId}/logo.${extension}`
    const bytes = new Uint8Array(await logoFile.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from("organisation-logos")
      .upload(path, bytes, { contentType: logoFile.type, upsert: true })
    if (uploadError) return { error: uploadError.message }

    const { error: logoError } = await supabase
      .from("organisations")
      .update({ logo_path: path })
      .eq("id", organisationId)
    if (logoError) return { error: logoError.message }
  }

  await recordAudit("organisation.identity_updated", "organisation", organisationId, {
    abn: Boolean(abn),
    registration: Boolean(registration),
    registrationGroups: registrationGroups.length,
    logo: Boolean(logoFile),
  })

  redirect("/dashboard")
}

export async function acceptInviteAction(
  token: string,
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") ?? "")
  const fullName = String(formData.get("full_name") ?? "").trim()

  const invite = await peekInvite(token)
  if (!invite) return { error: "This invite is invalid or has expired." }
  if (email !== String(invite.email).toLowerCase()) {
    return { error: "Use the email address this invite was sent to." }
  }

  await assertRateLimit(`invite:${token}:${await clientIp()}`, 8, 600)

  const supabase = await createServerSupabase()
  const { data: existing } = await supabase.auth.getUser()

  if (existing.user && existing.user.email?.toLowerCase() !== email) {
    return { error: "Sign out, then open this invite with the invited email." }
  }

  if (!existing.user) {
    if (!password || password.length < 8) {
      return { error: "Use a password of at least 8 characters." }
    }
    const signedUp = await sendSignupConfirmation({
      email,
      password,
      fullName,
      next: `/invite/${token}`,
    })
    if (signedUp.message) return signedUp
    if (signedUp.error) {
      const signedIn = await supabase.auth.signInWithPassword({ email, password })
      if (signedIn.error) return { error: signedUp.error }
    }
  }

  const { error } = await supabase.rpc("accept_invite", {
    p_token_hash: hashToken(token),
  })
  if (error) {
    return { error: error.message }
  }

  redirect("/me")
}
