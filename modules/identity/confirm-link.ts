import { appUrl } from "@/lib/env"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { sendAuthEmail } from "@/modules/reminders/email"

export const authEmailTypes = ["signup", "invite", "magiclink", "recovery"] as const
export type AuthEmailType = (typeof authEmailTypes)[number]

export function isAuthEmailType(value: string | null): value is AuthEmailType {
  return authEmailTypes.some((type) => type === value)
}

export function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/onboarding"
  }
  return value
}

export function authConfirmUrl(tokenHash: string, type: AuthEmailType, next: string) {
  const url = new URL("/auth/confirm", appUrl())
  url.searchParams.set("token_hash", tokenHash)
  url.searchParams.set("type", type)
  url.searchParams.set("next", safeNext(next))
  return url.toString()
}

function alreadyRegistered(message: string) {
  const text = message.toLowerCase()
  return text.includes("already") && (text.includes("registered") || text.includes("exists"))
}

async function deliver(input: {
  to: string
  tokenHash: string
  type: AuthEmailType
  next: string
  kind: "confirm" | "reset"
}) {
  const link = authConfirmUrl(input.tokenHash, input.type, input.next)
  if (input.kind === "reset") {
    return sendAuthEmail({
      to: input.to,
      subject: "Reset your Kinsa password",
      text: `Reset your Kinsa password:\n\n${link}\n\nIf you did not ask for this, you can ignore this email.\n`,
      html: `<p>Reset your Kinsa password.</p><p><a href="${escapeHtml(link)}">Choose a new password</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
    })
  }
  return sendAuthEmail({
    to: input.to,
    subject: "Confirm your Kinsa account",
    text: `Confirm your email to finish creating your organisation on Kinsa:\n\n${link}\n\nIf you did not create an account, you can ignore this email.\n`,
    html: `<p>Confirm your email to finish creating your organisation on Kinsa.</p><p><a href="${escapeHtml(link)}">Confirm email</a></p><p>If you did not create an account, you can ignore this email.</p>`,
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export async function sendSignupConfirmation(input: {
  email: string
  password: string
  fullName: string
  next: string
}): Promise<{ error?: string; message?: string }> {
  const admin = createAdminSupabase()
  const created = await admin.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName } },
  })

  if (!created.error) {
    const tokenHash = created.data.properties?.hashed_token
    if (!tokenHash) return { error: "The confirmation email could not be sent." }
    const sent = await deliver({
      to: input.email,
      tokenHash,
      type: "signup",
      next: input.next,
      kind: "confirm",
    })
    if (!sent.sent) return { error: sent.reason }
    return {
      message: "Check your email for a message from Kinsa, then confirm your account.",
    }
  }

  if (!alreadyRegistered(created.error.message)) return { error: created.error.message }

  const existing = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: input.email,
  })
  if (existing.error) return { error: existing.error.message }
  if (existing.data.user.email_confirmed_at) {
    return { error: "An account with this email already exists. Sign in." }
  }
  const tokenHash = existing.data.properties?.hashed_token
  if (!tokenHash) return { error: "The confirmation email could not be sent." }
  const sent = await deliver({
    to: input.email,
    tokenHash,
    type: "magiclink",
    next: input.next,
    kind: "confirm",
  })
  if (!sent.sent) return { error: sent.reason }
  return {
    message: "Check your email for a message from Kinsa, then confirm your account.",
  }
}

export async function sendPasswordReset(email: string): Promise<{ error?: string; message?: string }> {
  const quiet = {
    message: "If that email has an account, a reset link is on its way.",
  }
  const admin = createAdminSupabase()
  const link = await admin.auth.admin.generateLink({ type: "recovery", email })
  if (link.error) return quiet
  const tokenHash = link.data.properties?.hashed_token
  if (!tokenHash) return quiet
  const sent = await deliver({
    to: email,
    tokenHash,
    type: "recovery",
    next: "/reset-password",
    kind: "reset",
  })
  if (!sent.sent) return { error: "The reset email could not be sent." }
  return quiet
}
