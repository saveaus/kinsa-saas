import { Resend } from "resend"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL ?? "Kinsa <onboarding@resend.dev>"
}

export function renderTemplate(
  template: string,
  values: Record<string, string>
) {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => values[key] ?? ""
  )
}

export async function sendInviteEmail(input: {
  to: string
  workerName: string
  organisationName: string
  inviteUrl: string
}): Promise<{ sent: true } | { sent: false; reason: string }> {
  const resend = getResend()
  if (!resend) {
    return { sent: false, reason: "RESEND_API_KEY is not configured." }
  }

  const subject = `You're invited to ${input.organisationName} on Kinsa`
  const text = `Hello ${input.workerName},\n\n${input.organisationName} invited you to view your staff compliance record in Kinsa.\n\nAccept the invite: ${input.inviteUrl}\n\nThis link expires in 7 days.\n`
  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject,
      text,
      html: `<p>Hello ${escapeHtml(input.workerName)},</p><p>${escapeHtml(input.organisationName)} invited you to view your staff compliance record in Kinsa.</p><p><a href="${escapeHtml(input.inviteUrl)}">Accept the invite</a></p><p>This link expires in 7 days.</p>`,
    })
    if (error) return { sent: false, reason: error.message }
    return { sent: true }
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : "The email service did not respond."
    return { sent: false, reason }
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export async function sendAuthEmail(input: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<{ sent: true } | { sent: false; reason: string }> {
  const resend = getResend()
  if (!resend) {
    return { sent: false, reason: "RESEND_API_KEY is not configured." }
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })
    if (error) return { sent: false, reason: error.message }
    return { sent: true }
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : "The email service did not respond."
    return { sent: false, reason }
  }
}

export async function sendReminderEmail(input: {
  to: string
  subject: string
  body: string
}): Promise<{ sent: true } | { sent: false; reason: string }> {
  const resend = getResend()
  if (!resend) {
    return { sent: false, reason: "RESEND_API_KEY is not configured" }
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      text: input.body,
    })
    if (error) return { sent: false, reason: error.message }
    return { sent: true }
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : "The email service did not respond."
    return { sent: false, reason }
  }
}
