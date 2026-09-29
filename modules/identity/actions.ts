"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { appUrl } from "@/lib/env"
import { parseRegistrationGroups } from "@/lib/ndis-registration-groups"
import { assertRateLimit } from "@/lib/rate-limit"
import { createServerSupabase } from "@/lib/supabase/server"
import { requireAuthUser } from "@/lib/tenant"
import { hashToken } from "@/modules/identity/token"

export type AuthActionState = { error?: string; message?: string }

async function clientIp() {
  const headerStore = await headers()
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
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
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const fullName = String(formData.get("full_name") ?? "").trim()

  if (!email || !password || password.length < 8) {
    return { error: "Use a valid email and a password of at least 8 characters." }
  }

  await assertRateLimit(`signup:${email}:${await clientIp()}`, 5, 600)

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${appUrl()}/login`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.session) {
    return { message: "Check your email to confirm your account, then sign in." }
  }

  redirect("/onboarding")
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
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!email) return { error: "Email is required." }

  await assertRateLimit(`reset:${email}:${await clientIp()}`, 5, 600)

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl()}/reset-password`,
  })
  if (error) return { error: error.message }
  return { message: "If that email has an account, a reset link is on its way." }
}

export async function updatePasswordAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  await requireAuthUser()
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")
  if (password.length < 8) return { error: "Use a password of at least 8 characters." }
  if (password !== confirm) return { error: "Passwords do not match." }

  await assertRateLimit(`password:${await clientIp()}`, 8, 600)

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  return { message: "Password updated. You can sign in with it now." }
}

export async function createOrganisationAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  await requireAuthUser()
  const name = String(formData.get("name") ?? "").trim()
  if (!name) {
    return { error: "Organisation name is required." }
  }

  const registrationGroups = parseRegistrationGroups(formData)
  if (registrationGroups.length === 0) {
    return { error: "Select at least one NDIS registration group." }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.rpc("create_organisation", {
    org_name: name,
    p_registration_groups: registrationGroups,
  })
  if (error) {
    return { error: error.message }
  }

  redirect("/dashboard")
}

export async function acceptInviteAction(
  token: string,
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const fullName = String(formData.get("full_name") ?? "").trim()

  if (!email || !password || password.length < 8) {
    return { error: "Use the invited email and a password of at least 8 characters." }
  }

  await assertRateLimit(`invite:${token}:${await clientIp()}`, 8, 600)

  const supabase = await createServerSupabase()
  const { data: existing } = await supabase.auth.getUser()

  if (!existing.user) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) {
      const signedIn = await supabase.auth.signInWithPassword({ email, password })
      if (signedIn.error) {
        return { error: error.message }
      }
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
